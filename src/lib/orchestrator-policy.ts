// Pure orchestrator policy — no prisma, no server-only. Importable from node tests.
// (The WorkflowName import is type-only and erased at runtime.)
import type { WorkflowName } from "./workflows";

export type AgentKey =
  | "ads_creative"
  | "proactive_sales"
  | "content_research"
  | "intelligence"
  | "promotion"
  | "inbox_rules"
  | "approval_review";

export interface SignalSnapshot {
  revenue: { last7: number; prev7: number; deltaPct: number };
  leads: { hotUnclosed: number; coldNoNurture: number; newToday: number };
  inbox: { unread: number };
  comments: { negativeUnreplied: number };
  approvals: { pendingOver24h: number };
  posts: { scheduledTomorrow: number; engagement7dAvg: number; engagement14dPriorAvg: number };
  competitor: { surgeCount: number; topPostId: string | null };
  forecast: { next7Predicted: number; vsAverage: number };
  pendingDecisionFails: number;
}

export interface AgentPriority {
  agent: AgentKey;
  score: number;        // 0-100
  reason: string;
  recommendedAction: string;
}

export const AGENT_DOMAIN: Record<AgentKey, string> = {
  ads_creative: "ads",
  proactive_sales: "sales",
  content_research: "content",
  intelligence: "intelligence",
  promotion: "content",
  inbox_rules: "customer",
  approval_review: "operation",
};

export function scoreAgents(s: SignalSnapshot): AgentPriority[] {
  const out: AgentPriority[] = [];

  // Approval review — always urgent if stuck > 24h
  if (s.approvals.pendingOver24h > 0) {
    out.push({
      agent: "approval_review",
      score: 95,
      reason: `${s.approvals.pendingOver24h} yêu cầu chờ duyệt > 24h`,
      recommendedAction: "Vào /automation để duyệt",
    });
  }

  // Revenue down → push ads + promotion
  if (s.revenue.deltaPct < -0.2) {
    out.push({
      agent: "ads_creative",
      score: 90,
      reason: `Doanh thu giảm ${Math.round(s.revenue.deltaPct * -100)}% so 7 ngày trước`,
      recommendedAction: "Tạo campaign mới với AI Creative Assistant",
    });
    out.push({
      agent: "promotion",
      score: 85,
      reason: "Cần kích cầu — flash deal hỗ trợ ngắn hạn",
      recommendedAction: "Tạo Flash Deal tại /promotions",
    });
  }

  // Forecast warning
  if (s.forecast.vsAverage < -0.3) {
    out.push({
      agent: "promotion",
      score: 80,
      reason: `Forecast tuần tới thấp hơn ${Math.round(s.forecast.vsAverage * -100)}% so trung bình`,
      recommendedAction: "Cân nhắc tăng ads hoặc tạo promotion",
    });
  }

  // Hot leads pile up
  if (s.leads.hotUnclosed > 10) {
    out.push({
      agent: "proactive_sales",
      score: 85,
      reason: `${s.leads.hotUnclosed} lead nóng chưa chốt`,
      recommendedAction: "Chạy proactive outreach + check /sale",
    });
  }

  // Inbox backlog
  if (s.inbox.unread > 20) {
    out.push({
      agent: "inbox_rules",
      score: 75,
      reason: `${s.inbox.unread} tin nhắn chưa đọc — có thể thiếu rule cover`,
      recommendedAction: "Vào /inbox xem rule chưa đủ chủ đề nào",
    });
  }

  // Engagement drop
  if (s.posts.engagement7dAvg > 0 && s.posts.engagement14dPriorAvg > 0) {
    const dropPct = (s.posts.engagement14dPriorAvg - s.posts.engagement7dAvg) / s.posts.engagement14dPriorAvg;
    if (dropPct > 0.3) {
      out.push({
        agent: "content_research",
        score: 70,
        reason: `Engagement giảm ${Math.round(dropPct * 100)}% — content có thể chán`,
        recommendedAction: "Tạo plan content mới với AI Council",
      });
    }
  }

  // Competitor surge → Intelligence proactive
  if (s.competitor.surgeCount > 0) {
    out.push({
      agent: "intelligence",
      score: 65,
      reason: `${s.competitor.surgeCount} bài đối thủ viral > 500 likes`,
      recommendedAction: "AI Council phân tích đối thủ → tạo content phản hồi",
    });
  }

  // Comments negative
  if (s.comments.negativeUnreplied > 0) {
    out.push({
      agent: "approval_review",
      score: 80,
      reason: `${s.comments.negativeUnreplied} bình luận tiêu cực chưa xử lý`,
      recommendedAction: "Vào /auto-comment xử lý ngay",
    });
  }

  // Scheduled tomorrow = 0 → cần tạo
  if (s.posts.scheduledTomorrow === 0) {
    out.push({
      agent: "content_research",
      score: 60,
      reason: "Mai chưa có bài nào lên lịch",
      recommendedAction: "Gen content plan",
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function pickWorkflowForSignal(signals: SignalSnapshot): { name: WorkflowName; trigger: string } | null {
  if (signals.revenue.deltaPct < -0.2) {
    return { name: "revenue_drop", trigger: `Doanh thu giảm ${Math.round(-signals.revenue.deltaPct * 100)}% so 7 ngày trước` };
  }
  if (signals.competitor.surgeCount >= 2) {
    return { name: "competitor_surge", trigger: `${signals.competitor.surgeCount} đối thủ có bài viral` };
  }
  if (signals.posts.engagement7dAvg > 0 && signals.posts.engagement14dPriorAvg > 0) {
    const drop = (signals.posts.engagement14dPriorAvg - signals.posts.engagement7dAvg) / signals.posts.engagement14dPriorAvg;
    if (drop > 0.3) return { name: "engagement_drop", trigger: `Engagement giảm ${Math.round(drop * 100)}%` };
  }
  return null;
}
