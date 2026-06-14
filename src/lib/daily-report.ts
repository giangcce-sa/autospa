import { prisma } from "./db";
import { postToZalo } from "./zalo";
import { getInsights } from "./facebook-ads";
import { pullSpaRevenue } from "./spa-client";

function fmt(n: number) { return n.toLocaleString("vi-VN"); }
function fmtVnd(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

export async function buildDailyReport(): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const dateStr = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  // Posts
  const publishedToday = await prisma.post.count({ where: { status: "published", publishedAt: { gte: today } } });
  const scheduledUpcoming = await prisma.post.count({ where: { status: "scheduled", scheduledAt: { gte: new Date() } } });

  // Leads
  const newLeads = await prisma.lead.count({ where: { createdAt: { gte: today } } });
  const hotLeads = await prisma.lead.count({ where: { stage: "hot" } });
  const handedOff = await prisma.lead.count({ where: { handoffAt: { gte: today } } });

  // Care messages
  const careSent = await prisma.careMessage.count({ where: { sentAt: { gte: today } } });

  // Ads insights (best effort)
  let adsLine = "Chưa cấu hình";
  try {
    const insights = await getInsights(undefined, "today");
    adsLine = `Chi: ${fmtVnd(Number(insights.spend))} | CTR: ${(Number(insights.ctr) * 100).toFixed(1)}% | ROAS: ${insights.spend !== "0" ? (Number(insights.spend) > 0 ? "—" : "N/A") : "N/A"}`;
  } catch { /* no ad account configured */ }

  // Spa revenue (best effort)
  let spaLine = "Chưa kết nối";
  try {
    const spa = await pullSpaRevenue();
    spaLine = `Lịch hẹn: ${fmt(spa.bookingCountToday)} | Doanh thu: ${fmtVnd(spa.revenueToday)}`;
  } catch { /* no spa integration */ }

  // Upcoming scheduled posts for tomorrow (supervised mode content plan)
  const tomorrowPosts = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) } },
    select: { caption: true, scheduledAt: true },
    take: 5,
  });

  const lines = [
    `📊 BÁO CÁO NGÀY ${dateStr}`,
    "",
    "📱 NỘI DUNG",
    `  Đã đăng: ${publishedToday} bài | Đang lên lịch: ${scheduledUpcoming} bài`,
    "",
    "💰 QUẢNG CÁO",
    `  ${adsLine}`,
    "",
    "👥 LEAD",
    `  Mới hôm nay: ${newLeads} | Hot: ${hotLeads} | Đã chuyển spa: ${handedOff}`,
    "",
    "💆 SPA",
    `  ${spaLine}`,
  ];

  if (careSent > 0) {
    lines.push("", "📬 CHĂM SÓC KHÁCH", `  Đã gửi: ${careSent} tin nhắn`);
  }

  if (tomorrowPosts.length > 0) {
    lines.push("", "📋 LÊN LỊCH NGÀY MAI");
    tomorrowPosts.forEach((p) => {
      const time = p.scheduledAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) ?? "";
      lines.push(`  ${time} — ${p.caption.slice(0, 50)}${p.caption.length > 50 ? "..." : ""}`);
    });
  }

  return lines.join("\n");
}

export async function sendDailyReport(): Promise<void> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.zaloApprovalRecipient) return;

  let report = await buildDailyReport();

  // If supervised mode — append approval request for tomorrow's plan
  if (settings.automationLevel === "supervised") {
    const { requestApproval } = await import("./approval-gate");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowPosts = await prisma.post.findMany({
      where: { status: "scheduled", scheduledAt: { gte: tomorrow } },
      select: { id: true, caption: true },
      take: 10,
    });
    if (tomorrowPosts.length > 0) {
      const approvalId = await requestApproval(
        "content_plan",
        { postIds: tomorrowPosts.map((p) => p.id), count: tomorrowPosts.length },
        null // don't send separate Zalo — include in report
      );
      const { prisma: db } = await import("./db");
      const approval = await db.pendingApproval.findUnique({ where: { id: approvalId } });
      if (approval) {
        report += `\n\nGõ Y${approval.shortCode} để duyệt kế hoạch ngày mai, N${approval.shortCode} để bỏ qua.`;
      }
    }
  }

  await postToZalo(report, undefined, settings.zaloApprovalRecipient);
}
