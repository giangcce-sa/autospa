import { prisma } from "./db";
import { gzipSync } from "zlib";

/**
 * Export all user data as a single JSON object.
 * Excludes RateLimit (transient), RealtimeAlert (transient), and tokens that don't make sense to backup.
 */
export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const [
    settings, facebookPages,
    services, brandKit, brandKnowledge, styleSamples, styleProfiles, spaStories,
    posts, postAnalytics, contentReviews,
    customers, customerNotes, leads, leadConversations,
    inboxMessages, postComments, commentRules, messageRules,
    appointments, careMessages, holidayEvents,
    competitors, competitorPosts,
    pendingApprovals, adOptimizationLogs, spaSync,
    bookingRevenue, revenueForecasts,
    morningBriefs, ceoDecisions, workflowRuns, orchestratorRuns,
    intelligenceSignals,
    users,
  ] = await Promise.all([
    prisma.settings.findMany(),
    prisma.facebookPage.findMany(),
    prisma.service.findMany(),
    prisma.brandKit.findMany(),
    prisma.brandKnowledge.findMany(),
    prisma.styleSample.findMany(),
    prisma.styleProfile.findMany(),
    prisma.spaStory.findMany(),
    prisma.post.findMany(),
    prisma.postAnalytics.findMany(),
    prisma.contentReview.findMany(),
    prisma.customer.findMany(),
    prisma.customerNote.findMany(),
    prisma.lead.findMany(),
    prisma.leadConversation.findMany(),
    prisma.inboxMessage.findMany(),
    prisma.postComment.findMany(),
    prisma.commentRule.findMany(),
    prisma.messageRule.findMany(),
    prisma.appointmentRequest.findMany(),
    prisma.careMessage.findMany(),
    prisma.holidayEvent.findMany(),
    prisma.competitor.findMany(),
    prisma.competitorPost.findMany(),
    prisma.pendingApproval.findMany(),
    prisma.adOptimizationLog.findMany({ take: 500, orderBy: { createdAt: "desc" } }),
    prisma.spaSync.findMany(),
    prisma.bookingRevenue.findMany(),
    prisma.revenueForecast.findMany({ take: 30, orderBy: { generatedAt: "desc" } }),
    prisma.morningBrief.findMany({ take: 60, orderBy: { date: "desc" } }),
    prisma.cEODecision.findMany({ orderBy: { date: "desc" }, take: 200 }),
    prisma.workflowRun.findMany({ take: 100, orderBy: { startedAt: "desc" } }),
    prisma.orchestratorRun.findMany({ take: 50, orderBy: { runAt: "desc" } }),
    prisma.intelligenceSignal.findMany({ take: 500, orderBy: { fetchedAt: "desc" } }),
    prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true } }), // exclude hashedPwd
  ]);

  return {
    _meta: [{ exportedAt: new Date().toISOString(), version: "2.3.0" }],
    settings, facebookPages,
    services, brandKit, brandKnowledge, styleSamples, styleProfiles, spaStories,
    posts, postAnalytics, contentReviews,
    customers, customerNotes, leads, leadConversations,
    inboxMessages, postComments, commentRules, messageRules,
    appointments, careMessages, holidayEvents,
    competitors, competitorPosts,
    pendingApprovals, adOptimizationLogs, spaSync,
    bookingRevenue, revenueForecasts,
    morningBriefs, ceoDecisions, workflowRuns, orchestratorRuns,
    intelligenceSignals,
    users,
  };
}

export async function buildBackupGzip(): Promise<{ buffer: Buffer; size: number; rowCount: number }> {
  const data = await exportAllData();
  const json = JSON.stringify(data);
  const buffer = gzipSync(Buffer.from(json, "utf-8"));
  const rowCount = Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  return { buffer, size: buffer.length, rowCount };
}
