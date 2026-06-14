import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [approvals, adLogs, spaSync, leadConvs, nurtureLeads] = await Promise.all([
      prisma.pendingApproval.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adOptimizationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.spaSync.findFirst({ where: { id: "1" } }),
      prisma.leadConversation.findMany({
        where: { isComplete: false },
        include: { lead: { select: { name: true, phone: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.lead.findMany({
        where: { handoffAt: null, nurtureStep: { lt: 3 }, channelId: { not: null } },
        select: { id: true, name: true, service: true, channelType: true, nurtureStep: true, nurtureSentAt: true, createdAt: true },
        orderBy: { nurtureSentAt: "asc" },
        take: 20,
      }),
    ]);

    // Auto-expire timed-out approvals
    const timedOut = approvals.filter((a) => a.timeoutAt < now);
    if (timedOut.length > 0) {
      await prisma.pendingApproval.updateMany({
        where: { id: { in: timedOut.map((a) => a.id) } },
        data: { status: "timed_out" },
      });
    }

    const activeApprovals = approvals.filter((a) => a.timeoutAt >= now);
    const adLogsToday = adLogs.filter((l) => l.createdAt >= today);

    // Which nurture leads are due today?
    const nurtureDue = nurtureLeads.filter((l) => {
      const delay = [1, 3, 7][l.nurtureStep] ?? 7;
      const threshold = new Date(now.getTime() - delay * 24 * 60 * 60 * 1000);
      return (l.nurtureSentAt ?? l.createdAt) <= threshold;
    });

    return NextResponse.json({
      success: true,
      data: {
        approvals: activeApprovals,
        adLogs,
        adLogsCountToday: adLogsToday.length,
        spaSync,
        leadConversations: leadConvs,
        nurtureLeads,
        nurtureDueCount: nurtureDue.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
