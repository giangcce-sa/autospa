import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { getBusinessMonthRange } from "@/lib/today-policy";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const { start: startOfMonth } = getBusinessMonthRange();

    const [totalPosts, publishedThisMonth, scheduled, pendingAppointments, unreadMessages, services, recentPosts, totalCustomers, hotLeads, pendingCare, unreadAlerts] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "published", publishedAt: { gte: startOfMonth } } }),
      prisma.post.count({ where: { status: "scheduled" } }),
      prisma.appointmentRequest.count({ where: { status: "pending" } }),
      prisma.inboxMessage.count({ where: { isRead: false } }),
      prisma.service.count({ where: { active: true } }),
      prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { service: { select: { name: true } } } }),
      prisma.customer.count(),
      prisma.lead.count({ where: { stage: "hot" } }),
      prisma.careMessage.count({ where: { status: "pending" } }),
      prisma.socialAlert.count({ where: { isRead: false } }),
    ]);

    return NextResponse.json({
      data: { totalPosts, publishedThisMonth, scheduled, pendingAppointments, unreadMessages, services, recentPosts, totalCustomers, hotLeads, pendingCare, unreadAlerts },
      success: true,
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Lỗi khi tải dashboard", success: false }, { status: 500 });
  }
}
