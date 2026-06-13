import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải dashboard", success: false }, { status: 500 });
  }
}
