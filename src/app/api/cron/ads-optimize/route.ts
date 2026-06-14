import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getCampaigns, setCampaignStatus, updateCampaignBudget } from "@/lib/facebook-ads";
import { requestApproval } from "@/lib/approval-gate";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const settings = await prisma.settings.findFirst();
  if (!settings) return NextResponse.json({ skipped: "no settings" });

  // Prevent running more than once per 3.5h
  const sync = await prisma.spaSync.findFirst();
  if (sync?.lastAdsOptRun) {
    const elapsed = Date.now() - sync.lastAdsOptRun.getTime();
    if (elapsed < 3.5 * 60 * 60 * 1000) {
      return NextResponse.json({ skipped: "too_soon", nextRunIn: Math.round((3.5 * 3600000 - elapsed) / 60000) + "min" });
    }
  }

  const level = settings.automationLevel;
  const pauseCtr = settings.adsOptimizePauseCtr / 100;
  const scaleCtr = settings.adsOptimizeScaleCtr / 100;
  const freqLimit = settings.adsOptimizeFreqLimit;
  const scalePct = settings.adsOptimizeScalePct;
  const recipient = settings.zaloApprovalRecipient;

  let campaigns;
  try {
    campaigns = await getCampaigns();
  } catch {
    return NextResponse.json({ error: "Không lấy được campaigns từ Facebook" });
  }

  const logs: Array<{ campaign: string; action: string; reason: string }> = [];

  for (const c of campaigns) {
    if (c.status !== "ACTIVE") continue;
    const ctr = Number(c.ctr ?? 0);
    const spend = Number(c.spend ?? 0);
    const startAge = c.startTime ? (Date.now() - new Date(c.startTime).getTime()) / 3600000 : 0;

    // Rule 1: Pause bad performer
    if (ctr < pauseCtr && spend > 50000 && startAge > 72) {
      if (level === "full") {
        try {
          await setCampaignStatus(c.id, "PAUSED");
          await prisma.adOptimizationLog.create({
            data: { campaignId: c.id, campaignName: c.name, action: "paused", reason: `CTR ${(ctr * 100).toFixed(2)}% < ngưỡng ${settings.adsOptimizePauseCtr}%`, oldValue: c.status, newValue: "PAUSED" },
          });
          logs.push({ campaign: c.name, action: "paused", reason: "low CTR" });
        } catch { /* continue */ }
      } else if (level === "semi") {
        const approvalId = await requestApproval("pause_campaign", { campaignId: c.id, campaignName: c.name, ctr: (ctr * 100).toFixed(2) + "%", spend }, recipient);
        await prisma.adOptimizationLog.create({
          data: { campaignId: c.id, campaignName: c.name, action: "pending_approval", reason: `CTR thấp — chờ duyệt pause`, newValue: approvalId },
        });
        logs.push({ campaign: c.name, action: "approval_sent", reason: "low CTR" });
      } else {
        await prisma.adOptimizationLog.create({
          data: { campaignId: c.id, campaignName: c.name, action: "skipped", reason: `CTR thấp (${(ctr * 100).toFixed(2)}%) — supervised mode` },
        });
      }
    }

    // Rule 2: Scale good performer
    else if (ctr > scaleCtr && spend > 100000) {
      const currentBudget = Number(c.dailyBudget ?? 0);
      if (currentBudget > 0) {
        const newBudget = Math.round(currentBudget * (1 + scalePct / 100));
        if (level === "full") {
          try {
            await updateCampaignBudget(c.id, newBudget);
            await prisma.adOptimizationLog.create({
              data: { campaignId: c.id, campaignName: c.name, action: "scaled_budget", reason: `CTR tốt (${(ctr * 100).toFixed(2)}%)`, oldValue: String(currentBudget), newValue: String(newBudget) },
            });
            logs.push({ campaign: c.name, action: "scaled", reason: "high CTR" });
          } catch { /* continue */ }
        } else if (level === "semi") {
          await requestApproval("budget_increase", { campaignId: c.id, campaignName: c.name, ctr: (ctr * 100).toFixed(2) + "%", oldBudget: currentBudget, newBudget }, recipient);
          logs.push({ campaign: c.name, action: "approval_sent", reason: "scale budget" });
        } else {
          await prisma.adOptimizationLog.create({
            data: { campaignId: c.id, campaignName: c.name, action: "skipped", reason: `CTR cao — supervised mode không auto-scale` },
          });
        }
      }
    }

    // Rule 3: High frequency — flag only
    if (Number(c.impressions ?? 0) > 0 && Number(c.reach ?? 0) > 0) {
      const freq = Number(c.impressions) / Number(c.reach);
      if (freq > freqLimit) {
        await prisma.adOptimizationLog.create({
          data: { campaignId: c.id, campaignName: c.name, action: "flagged_refresh", reason: `Frequency ${freq.toFixed(1)} > ${freqLimit} — cần thay creative`, oldValue: String(freq) },
        });
        logs.push({ campaign: c.name, action: "flagged", reason: "high frequency" });
      }
    }
  }

  await prisma.spaSync.upsert({
    where: { id: "1" },
    update: { lastAdsOptRun: new Date() },
    create: { id: "1", lastAdsOptRun: new Date() },
  });

  return NextResponse.json({ checked: campaigns.length, actions: logs });
}
