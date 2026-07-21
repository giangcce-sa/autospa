import { prisma } from "@/lib/db";
import { getCampaigns, setCampaignStatus, updateAdsBudget, type Campaign } from "@/lib/facebook-ads";
import { requestApproval } from "@/lib/approval-gate";
import { acquireAutomationLock, releaseAutomationLock } from "@/lib/automation-lock";
import { finishJobRun, startJobRun, type JobTrigger } from "@/lib/activity-log";
import { evaluateAdsPolicy } from "@/lib/ads-optimization-policy";
import { getEffectiveAdsAutomationLevel, shouldForceAdsDryRun } from "@/lib/ads-safety";

type OptimizationAction = { campaign: string; action: string; reason: string };

function metricReason(campaign: Campaign) {
  return `CTR ${Number(campaign.ctr ?? 0).toFixed(2)}%, chi ${Number(campaign.spend ?? 0).toLocaleString("vi-VN")}đ`;
}

async function logDecision(campaign: Campaign, action: string, reason: string, oldValue?: string, newValue?: string) {
  await prisma.adOptimizationLog.create({
    data: { campaignId: campaign.id, campaignName: campaign.name, action, reason, oldValue, newValue },
  });
}

export async function runAdsOptimization(input: {
  trigger: JobTrigger;
  dryRun?: boolean;
  ignoreCooldown?: boolean;
}) {
  const owner = await acquireAutomationLock("ads-optimize");
  if (!owner) return { skipped: "already_running", checked: 0, actions: [] as OptimizationAction[] };

  const forcedDryRun = shouldForceAdsDryRun();
  const effectiveDryRun = forcedDryRun || Boolean(input.dryRun);
  const job = await startJobRun("ads_optimize", input.trigger, effectiveDryRun ? "Ads optimization dry-run" : "Ads optimization");
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings) throw new Error("Chưa có cấu hình hệ thống");

    const automationLevel = getEffectiveAdsAutomationLevel(settings.automationLevel);
    const pages = await prisma.facebookPage.findMany({
      where: { isActive: true, adAccountId: { not: null } },
      select: { id: true },
    });
    const campaigns = (await Promise.all(pages.map((page) => getCampaigns(page.id)))).flat();
    const actions: OptimizationAction[] = [];
    const cooldownSince = new Date(Date.now() - settings.adsOptimizeCooldownHrs * 3_600_000);
    const attribution = await prisma.bookingRevenue.groupBy({
      by: ["fromCampaignId"],
      where: {
        fromCampaignId: { in: campaigns.map((campaign) => campaign.id) },
        paidAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const attributionByCampaign = new Map(
      attribution.map((row) => [
        row.fromCampaignId,
        { revenue: row._sum.amount ?? 0, bookings: row._count._all },
      ]),
    );

    for (const campaign of campaigns) {
      if (campaign.status !== "ACTIVE") continue;
      const ctrPercent = Number(campaign.ctr ?? 0);
      const spend = Number(campaign.spend ?? 0);
      const impressions = Number(campaign.impressions ?? 0);
      const reach = Number(campaign.reach ?? 0);
      const ageHours = campaign.startTime ? (Date.now() - new Date(campaign.startTime).getTime()) / 3_600_000 : 0;
      const attributed = attributionByCampaign.get(campaign.id) ?? { revenue: 0, bookings: 0 };
      const roas = spend > 0 ? attributed.revenue / spend : 0;

      if (spend < settings.adsOptimizeMinSpend || impressions < 1_000 || ageHours < 72) {
        continue;
      }

      const recentAction = input.trigger === "manual" && input.ignoreCooldown && !forcedDryRun
        ? null
        : await prisma.adOptimizationLog.findFirst({
            where: {
              campaignId: campaign.id,
              action: { in: ["paused", "scaled_budget", "pending_approval"] },
              createdAt: { gte: cooldownSince },
            },
          });
      if (recentAction) {
        actions.push({ campaign: campaign.name, action: "cooldown", reason: "Đã có hành động gần đây" });
        continue;
      }

      let type: "pause_campaign" | "budget_increase" | null = null;
      let oldValue: string | undefined;
      let newValue: string | undefined;
      let reason = "";
      let payload: Record<string, unknown> = {};

      const policy = evaluateAdsPolicy({
        ctrPercent,
        currentBudget: campaign.budgetTarget ? Number(campaign.budgetTarget.dailyBudget) : undefined,
        pauseCtrPercent: settings.adsOptimizePauseCtr,
        scaleCtrPercent: settings.adsOptimizeScaleCtr,
        scalePercent: settings.adsOptimizeScalePct,
        maxDailyBudget: settings.adsOptimizeMaxBudget,
        budgetIssue: campaign.budgetIssue,
        roas,
        minRoas: settings.adsOptimizeMinRoas,
      });

      if (policy.type === "pause") {
        type = "pause_campaign";
        oldValue = campaign.status;
        newValue = "PAUSED";
        reason = `CTR dưới ngưỡng ${settings.adsOptimizePauseCtr}% (${metricReason(campaign)}, ROAS ${roas.toFixed(2)})`;
        payload = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          facebookPageId: campaign.facebookPageId,
          adAccountId: campaign.adAccountId,
          ctr: `${ctrPercent.toFixed(2)}%`,
          spend,
          roas,
          bookings: attributed.bookings,
        };
      } else if (policy.type === "skip") {
        reason = policy.reason;
        await logDecision(campaign, "skipped", reason);
        actions.push({ campaign: campaign.name, action: "skipped", reason });
        continue;
      } else if (policy.type === "scale" && campaign.budgetTarget) {
        const currentBudget = Number(campaign.budgetTarget.dailyBudget);
        const nextBudget = policy.nextBudget;
        type = "budget_increase";
        oldValue = String(currentBudget);
        newValue = String(nextBudget);
        reason = `CTR và ROAS đạt ngưỡng (${metricReason(campaign)}, ROAS ${roas.toFixed(2)})`;
        payload = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          facebookPageId: campaign.facebookPageId,
          adAccountId: campaign.adAccountId,
          budgetTargetId: campaign.budgetTarget.id,
          budgetTargetType: campaign.budgetTarget.type,
          ctr: `${ctrPercent.toFixed(2)}%`,
          oldBudget: currentBudget,
          newBudget: nextBudget,
          roas,
          bookings: attributed.bookings,
        };
      }

      if (type) {
        if (effectiveDryRun || automationLevel === "supervised") {
          const action = effectiveDryRun ? "dry_run" : "recommended";
          const effectiveReason = forcedDryRun ? `${reason} (server buộc dry-run)` : reason;
          await logDecision(campaign, action, effectiveReason, oldValue, newValue);
          actions.push({ campaign: campaign.name, action, reason: effectiveReason });
        } else if (automationLevel === "semi") {
          await requestApproval(type, payload, settings.zaloApprovalRecipient);
          await logDecision(campaign, "pending_approval", reason, oldValue, newValue);
          actions.push({ campaign: campaign.name, action: "pending_approval", reason });
        } else if (automationLevel === "full") {
          try {
            if (type === "pause_campaign") {
              await setCampaignStatus(campaign.id, "PAUSED", campaign.facebookPageId);
            } else {
              await updateAdsBudget({
                campaignId: campaign.id,
                targetId: String(payload.budgetTargetId),
                targetType: String(payload.budgetTargetType) as "campaign" | "adset",
                dailyBudgetVnd: Number(payload.newBudget),
                facebookPageId: campaign.facebookPageId,
              });
            }
            await logDecision(campaign, type === "pause_campaign" ? "paused" : "scaled_budget", reason, oldValue, newValue);
            actions.push({ campaign: campaign.name, action: type, reason });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await logDecision(campaign, "failed", message, oldValue, newValue);
            actions.push({ campaign: campaign.name, action: "failed", reason: message });
          }
        }
      }

      if (reach > 0 && impressions / reach > settings.adsOptimizeFreqLimit) {
        const frequency = impressions / reach;
        const frequencyReason = `Frequency ${frequency.toFixed(1)} > ${settings.adsOptimizeFreqLimit}`;
        await logDecision(campaign, "flagged_refresh", frequencyReason, String(frequency));
        actions.push({ campaign: campaign.name, action: "flagged_refresh", reason: frequencyReason });
      }
    }

    await prisma.spaSync.upsert({
      where: { id: "1" },
      update: { lastAdsOptRun: new Date() },
      create: { id: "1", lastAdsOptRun: new Date() },
    });
    const result = {
      checked: campaigns.length,
      actions,
      dryRun: effectiveDryRun,
      forcedDryRun,
      automationLevel,
    };
    await finishJobRun(job.id, {
      status: "completed",
      summary: `${campaigns.length} campaign, ${actions.length} quyết định`,
      metrics: result,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJobRun(job.id, { status: "failed", error: message, summary: "Ads optimization failed" }).catch(() => null);
    throw error;
  } finally {
    await releaseAutomationLock("ads-optimize", owner).catch(() => null);
  }
}
