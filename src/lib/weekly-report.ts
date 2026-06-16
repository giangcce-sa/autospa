import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram";

function fmt(n: number) { return n.toLocaleString("vi-VN"); }
function vnd(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}
function pct(a: number, b: number) {
  if (b === 0) return "—";
  const d = Math.round(((a - b) / b) * 100);
  return d >= 0 ? `+${d}%` : `${d}%`;
}

export async function generateWeeklyReport(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeekAgo = new Date(now.getTime() - 14 * 86400000);

  const [
    postsThisWeek, postsLastWeek,
    analyticsThisWeek, analyticsLastWeek,
    leadsThisWeek, leadsLastWeek,
    closedThisWeek, closedLastWeek,
    hotLeads, totalLeads,
    topPosts,
    spaSync,
    recentAlerts,
  ] = await Promise.all([
    prisma.post.count({ where: { status: "published", publishedAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { status: "published", publishedAt: { gte: twoWeekAgo, lt: weekAgo } } }),
    prisma.postAnalytics.aggregate({ _sum: { reach: true, likes: true, comments: true, shares: true }, where: { post: { publishedAt: { gte: weekAgo } } } }),
    prisma.postAnalytics.aggregate({ _sum: { reach: true, likes: true, comments: true, shares: true }, where: { post: { publishedAt: { gte: twoWeekAgo, lt: weekAgo } } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { createdAt: { gte: twoWeekAgo, lt: weekAgo } } }),
    prisma.lead.count({ where: { stage: "closed", updatedAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { stage: "closed", updatedAt: { gte: twoWeekAgo, lt: weekAgo } } }),
    prisma.lead.count({ where: { stage: "hot" } }),
    prisma.lead.count(),
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: weekAgo }, analytics: { isNot: null } },
      include: { analytics: true },
      orderBy: { analytics: { likes: "desc" } },
      take: 3,
    }),
    prisma.spaSync.findFirst(),
    prisma.realtimeAlert.findMany({ where: { detectedAt: { gte: weekAgo }, acknowledged: false }, orderBy: { detectedAt: "desc" }, take: 3 }),
  ]);

  const reach = analyticsThisWeek._sum.reach ?? 0;
  const reachLast = analyticsLastWeek._sum.reach ?? 0;
  const likes = analyticsThisWeek._sum.likes ?? 0;
  const likesLast = analyticsLastWeek._sum.likes ?? 0;
  const comments = analyticsThisWeek._sum.comments ?? 0;
  const shares = analyticsThisWeek._sum.shares ?? 0;
  const engagement = likes + comments * 2 + shares * 3;
  const engagementLast = (analyticsLastWeek._sum.likes ?? 0) + (analyticsLastWeek._sum.comments ?? 0) * 2 + (analyticsLastWeek._sum.shares ?? 0) * 3;
  const convRate = leadsThisWeek > 0 ? Math.round((closedThisWeek / leadsThisWeek) * 100) : 0;

  const weekLabel = `${weekAgo.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;

  let report = `📊 *BÁO CÁO TUẦN — AutoSpa*\n`;
  report += `_${weekLabel}_\n`;
  report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Content
  report += `📝 *NỘI DUNG*\n`;
  report += `• Bài đã đăng: *${postsThisWeek}* ${pct(postsThisWeek, postsLastWeek)}\n`;
  report += `• Tiếp cận: *${fmt(reach)}* ${pct(reach, reachLast)}\n`;
  report += `• Tương tác: *${fmt(engagement)}* ${pct(engagement, engagementLast)}\n`;
  report += `• Lượt thích: *${fmt(likes)}* ${pct(likes, likesLast)}\n\n`;

  // Leads
  report += `🔥 *LEADS & BÁN HÀNG*\n`;
  report += `• Lead mới: *${leadsThisWeek}* ${pct(leadsThisWeek, leadsLastWeek)}\n`;
  report += `• Đã chốt: *${closedThisWeek}* ${pct(closedThisWeek, closedLastWeek)}\n`;
  report += `• Tỷ lệ chốt: *${convRate}%*\n`;
  report += `• Lead nóng đang có: *${hotLeads}* / ${totalLeads} tổng\n\n`;

  // Revenue
  if (spaSync?.revenueToday) {
    report += `💰 *DOANH THU HÔM NAY*\n`;
    report += `• *${vnd(spaSync.revenueToday)}đ* · ${spaSync.bookingCountToday ?? 0} lịch hẹn\n\n`;
  }

  // Top posts
  if (topPosts.length > 0) {
    report += `🏆 *TOP BÀI TUẦN NÀY*\n`;
    topPosts.forEach((p, i) => {
      const caption = p.caption.slice(0, 50).replace(/\n/g, " ");
      const a = p.analytics!;
      report += `${i + 1}\\. ${caption}…\n`;
      report += `   👍 ${a.likes} · 💬 ${a.comments} · 🔁 ${a.shares}\n`;
    });
    report += "\n";
  }

  // Alerts
  if (recentAlerts.length > 0) {
    report += `⚠️ *CẢNH BÁO CHƯA XỬ LÝ*\n`;
    recentAlerts.forEach((a) => {
      report += `• ${a.type.replace(/_/g, " ")}: ${a.signal.slice(0, 60)}\n`;
    });
    report += "\n";
  }

  // Footer
  report += `━━━━━━━━━━━━━━━━━━━━\n`;
  report += `_Báo cáo tự động lúc ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · AutoSpa AI_`;

  return report;
}

export async function sendWeeklyReport() {
  const text = await generateWeeklyReport();
  return sendMessage(text);
}
