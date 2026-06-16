import { prisma } from "./db";
import { triggerWorkflow } from "./workflows";
import { postToZalo } from "./zalo";
import { sendAlert as sendTelegramAlert } from "./telegram";

/**
 * Realtime monitor — runs every 15 minutes to detect critical anomalies.
 * Throttled: same alert type cannot fire within 3 hours.
 */

const THROTTLE_HOURS = 3;

async function shouldFire(type: string): Promise<boolean> {
  const since = new Date(Date.now() - THROTTLE_HOURS * 3600 * 1000);
  const recent = await prisma.realtimeAlert.findFirst({
    where: { type, detectedAt: { gte: since } },
  });
  return !recent;
}

async function recordAlert(type: string, signal: string, severity: "warning" | "critical", workflowRunId?: string) {
  await prisma.realtimeAlert.create({
    data: { type, signal, severity, workflowRunId: workflowRunId ?? null },
  });
}

async function notifyAdmin(message: string, title = "REALTIME ALERT", severity: "critical" | "warning" | "info" = "warning") {
  const settings = await prisma.settings.findFirst();
  // Zalo notify
  if (settings?.zaloApprovalRecipient) {
    try {
      await postToZalo(`🚨 REALTIME ALERT\n${message}`, undefined, settings.zaloApprovalRecipient);
    } catch { /* swallow */ }
  }
  // Telegram notify
  try {
    await sendTelegramAlert(title, message, severity);
  } catch { /* swallow */ }
}

/**
 * Check 1: Negative comment spike — > 5 negative comments unreplied in last hour
 */
async function checkNegativeCommentSpike(): Promise<{ fired: boolean; signal?: string }> {
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const count = await prisma.postComment.count({
    where: { isAlert: true, isReplied: false, createdAt: { gte: hourAgo } },
  });
  if (count >= 5) {
    return { fired: true, signal: `${count} bình luận tiêu cực trong 1 giờ qua` };
  }
  return { fired: false };
}

/**
 * Check 2: Hot lead pileup — > 15 hot unhandled leads
 */
async function checkLeadPileup(): Promise<{ fired: boolean; signal?: string }> {
  const count = await prisma.lead.count({ where: { stage: "hot" } });
  if (count >= 15) {
    return { fired: true, signal: `${count} lead nóng đang dồn (chưa chốt)` };
  }
  return { fired: false };
}

/**
 * Check 3: Ads spend anomaly — pause/scale logs > 3 in last 30 min
 */
async function checkAdsAnomaly(): Promise<{ fired: boolean; signal?: string }> {
  const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
  const count = await prisma.adOptimizationLog.count({
    where: { createdAt: { gte: halfHourAgo }, action: "pause" },
  });
  if (count >= 3) {
    return { fired: true, signal: `${count} campaign bị pause trong 30 phút — có thể thiết lập sai` };
  }
  return { fired: false };
}

/**
 * Check 4: Revenue hour-over-hour drop
 * Compare last 2h to previous 2h of same day. If drop > 50% AND prev > 0, alert.
 */
async function checkRevenueHourly(): Promise<{ fired: boolean; signal?: string }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 1 * 3600 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);

  const [recent, prev] = await Promise.all([
    prisma.bookingRevenue.aggregate({
      where: { paidAt: { gte: twoHoursAgo, lt: now } },
      _sum: { amount: true },
    }),
    prisma.bookingRevenue.aggregate({
      where: { paidAt: { gte: threeHoursAgo, lt: oneHourAgo } },
      _sum: { amount: true },
    }),
  ]);

  const recentSum = recent._sum.amount ?? 0;
  const prevSum = prev._sum.amount ?? 0;

  if (prevSum > 100000 && recentSum < prevSum * 0.5) {
    return {
      fired: true,
      signal: `Doanh thu 2h gần đây giảm ${Math.round((1 - recentSum / prevSum) * 100)}% (${recentSum.toLocaleString("vi-VN")}đ vs ${prevSum.toLocaleString("vi-VN")}đ)`,
    };
  }
  return { fired: false };
}

export interface RealtimeMonitorResult {
  checks: { type: string; fired: boolean; signal?: string; workflowTriggered?: string }[];
  alertsCreated: number;
  workflowsTriggered: number;
}

export async function runRealtimeMonitor(): Promise<RealtimeMonitorResult> {
  const checks: RealtimeMonitorResult["checks"] = [];
  let alertsCreated = 0;
  let workflowsTriggered = 0;

  // Run all checks
  const [negSpike, leadPile, adsAnom, revDrop] = await Promise.all([
    checkNegativeCommentSpike(),
    checkLeadPileup(),
    checkAdsAnomaly(),
    checkRevenueHourly(),
  ]);

  // Handle each
  const handlers: Array<{
    type: string;
    result: { fired: boolean; signal?: string };
    severity: "warning" | "critical";
    workflow?: "revenue_drop" | "competitor_surge" | "engagement_drop";
  }> = [
    { type: "negative_spike", result: negSpike, severity: "critical" },
    { type: "lead_pile", result: leadPile, severity: "warning" },
    { type: "ad_anomaly", result: adsAnom, severity: "warning" },
    { type: "revenue_drop", result: revDrop, severity: "critical", workflow: "revenue_drop" },
  ];

  for (const h of handlers) {
    if (!h.result.fired) {
      checks.push({ type: h.type, fired: false });
      continue;
    }

    const canFire = await shouldFire(h.type);
    if (!canFire) {
      checks.push({ type: h.type, fired: false, signal: `${h.result.signal} (throttled)` });
      continue;
    }

    let workflowId: string | undefined;
    if (h.workflow) {
      try {
        const wf = await triggerWorkflow(h.workflow, h.result.signal!);
        workflowId = wf.id;
        workflowsTriggered++;
      } catch { /* continue with alert only */ }
    }

    await recordAlert(h.type, h.result.signal!, h.severity, workflowId);
    alertsCreated++;
    await notifyAdmin(`[${h.severity.toUpperCase()}] ${h.type}: ${h.result.signal}${workflowId ? `\n→ Đã trigger workflow ${h.workflow}` : ""}`);

    checks.push({
      type: h.type,
      fired: true,
      signal: h.result.signal,
      workflowTriggered: h.workflow,
    });
  }

  return { checks, alertsCreated, workflowsTriggered };
}
