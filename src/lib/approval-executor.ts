import { prisma } from "@/lib/db";
import { assertAdsReadiness } from "@/lib/ads-readiness";
import { enforceAdsMutation } from "@/lib/ads-safety";
import { setCampaignStatus, updateAdsBudget } from "@/lib/facebook-ads";

type Decision = "approved" | "rejected";

export async function executeApproval(id: string, decision: Decision) {
  const approval = await prisma.pendingApproval.findUnique({ where: { id } });
  if (!approval || approval.status !== "pending" || approval.timeoutAt < new Date()) {
    if (approval?.status === "pending") {
      await prisma.pendingApproval.update({ where: { id }, data: { status: "timed_out" } });
    }
    throw new Error("Approval không còn hiệu lực");
  }

  if (decision === "rejected") {
    await prisma.pendingApproval.update({
      where: { id },
      data: { status: "rejected", decidedAt: new Date() },
    });
    return { status: "rejected" as const };
  }

  if (!["pause_campaign", "budget_increase", "flash_deal"].includes(approval.type)) {
    await prisma.pendingApproval.update({
      where: { id },
      data: { status: "approved", decidedAt: new Date() },
    });
    return { status: "approved" as const };
  }

  const payload = JSON.parse(approval.payload) as Record<string, unknown>;
  if (approval.type === "pause_campaign" || approval.type === "budget_increase") {
    const facebookPageId = payload.facebookPageId ? String(payload.facebookPageId) : undefined;
    const adAccountId = payload.adAccountId ? String(payload.adAccountId) : undefined;
    await enforceAdsMutation({
      operation: approval.type,
      facebookPageId,
      adAccountId,
      minimumMode: "semi",
    });
    await assertAdsReadiness(facebookPageId, adAccountId);
  }

  const claimed = await prisma.pendingApproval.updateMany({
    where: { id, status: "pending" },
    data: { status: "executing", decidedAt: new Date(), executionError: null },
  });
  if (claimed.count !== 1) throw new Error("Approval đang được xử lý");

  try {
    if (approval.type === "pause_campaign") {
      await setCampaignStatus(String(payload.campaignId), "PAUSED", payload.facebookPageId ? String(payload.facebookPageId) : undefined);
    } else if (approval.type === "budget_increase") {
      await updateAdsBudget({
        campaignId: String(payload.campaignId),
        targetId: String(payload.budgetTargetId),
        targetType: String(payload.budgetTargetType) as "campaign" | "adset",
        dailyBudgetVnd: Number(payload.newBudget),
        facebookPageId: payload.facebookPageId ? String(payload.facebookPageId) : undefined,
      });
    } else if (approval.type === "flash_deal") {
      const { postFlashDeal } = await import("@/lib/flash-deal-engine");
      const posted = await postFlashDeal(String(payload.caption ?? ""));
      if (!posted.facebook && !posted.zalo && !posted.telegram) {
        throw new Error("Không đăng được Flash Deal lên kênh nào");
      }
    }

    const operations = [
      prisma.pendingApproval.update({
        where: { id },
        data: { status: "executed", executedAt: new Date(), executionError: null },
      }),
    ];
    if (approval.type === "pause_campaign" || approval.type === "budget_increase") {
      await prisma.$transaction([
        ...operations,
        prisma.adOptimizationLog.create({
          data: {
            campaignId: String(payload.campaignId ?? "unknown"),
            campaignName: String(payload.campaignName ?? "Campaign"),
            action: approval.type === "pause_campaign" ? "paused" : "scaled_budget",
            reason: "Đã được người dùng phê duyệt",
            oldValue: payload.oldBudget != null ? String(payload.oldBudget) : undefined,
            newValue: approval.type === "pause_campaign" ? "PAUSED" : String(payload.newBudget),
          },
        }),
      ]);
    } else {
      await operations[0];
    }
    return { status: "executed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const approvalFailure = prisma.pendingApproval.update({
        where: { id },
        data: { status: "failed", executionError: message },
      });
    if (approval.type === "pause_campaign" || approval.type === "budget_increase") {
      await prisma.$transaction([approvalFailure, prisma.adOptimizationLog.create({
        data: {
          campaignId: String(payload.campaignId ?? "unknown"),
          campaignName: String(payload.campaignName ?? "Campaign"),
          action: "failed",
          reason: message,
        },
      })]);
    } else {
      await approvalFailure;
    }
    throw error;
  }
}
