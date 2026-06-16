import { generateIntelligenceReport, type IntelligenceReport } from "./sub-agents/intelligence-report";
import { generateAdsReport, type AdsReport } from "./sub-agents/ads-report";
import { generateContentReport, type ContentReport } from "./sub-agents/content-report";
import { generateSalesReport, type SalesReport } from "./sub-agents/sales-report";
import { councilDebate } from "./ai-council";
import { formatPriorContext, saveDecision } from "./ceo-memory";
import { generateContent } from "./claude";

export interface SubReports {
  intelligence: IntelligenceReport;
  ads: AdsReport;
  content: ContentReport;
  sales: SalesReport;
}

export interface Assignment {
  agent: "content" | "ads" | "sales" | "intelligence" | "all";
  task: string;
  priority: "high" | "medium" | "low";
  dueBy?: string;
}

export interface DailyStandupResult {
  date: string;
  subReports: SubReports;
  ceoSummary: string;
  assignments: Assignment[];
  debate: { speaker: string; content: string; provider: string }[];
}

function flattenReport(name: string, r: { summary: string; recommendations: string[] }): string {
  return `[${name.toUpperCase()}]
Summary: ${r.summary}
Recommendations: ${r.recommendations.join(" | ") || "(none)"}`;
}

export async function runDailyStandup(): Promise<DailyStandupResult> {
  const dateStr = new Date().toISOString().slice(0, 10);

  // Run 4 sub-agents in parallel
  const [intelligence, ads, content, sales] = await Promise.all([
    generateIntelligenceReport().catch((e) => ({
      summary: `(Intelligence Agent lỗi: ${String(e).slice(0, 100)})`,
      trends: [], competitorAlerts: [], recommendations: [],
    } as IntelligenceReport)),
    generateAdsReport().catch((e) => ({
      summary: `(Ads Agent lỗi: ${String(e).slice(0, 100)})`,
      performance: [], alerts: [], recommendations: [],
    } as AdsReport)),
    generateContentReport().catch((e) => ({
      summary: `(Content Agent lỗi: ${String(e).slice(0, 100)})`,
      topPerformers: [], underperformers: [], recommendations: [],
    } as ContentReport)),
    generateSalesReport().catch((e) => ({
      summary: `(Sales Agent lỗi: ${String(e).slice(0, 100)})`,
      funnelStats: [], hotLeads: [], recommendations: [],
    } as SalesReport)),
  ]);

  const subReports: SubReports = { intelligence, ads, content, sales };

  // Build context for CEO Council
  const reportContext = [
    flattenReport("intelligence", intelligence),
    flattenReport("ads", ads),
    flattenReport("content", content),
    flattenReport("sales", sales),
  ].join("\n\n");

  // CEO Council debates — what to focus on today
  const topic = "Standup tổng kết — Hôm nay đội nên tập trung gì và giao việc cho ai?";
  const priorContext = await formatPriorContext(topic).catch(() => "");

  const council = await councilDebate({
    topic,
    context: `BÁO CÁO 4 SUB-AGENT:\n\n${reportContext}`,
    priorContext,
  });

  // Save to CEO Memory
  await saveDecision({
    topic,
    context: reportContext,
    council,
    source: "morning_brief",
    outcomeMetric: "revenue",
    outcomeCheckInDays: 7,
  }).catch(() => null);

  // Convert synthesis → structured assignments
  const formatPrompt = `Kết luận CEO Council:
${council.synthesis}

Convert thành JSON CHÍNH XÁC:
{
  "ceoSummary": "tóm tắt 2-3 câu giọng thân thiện",
  "assignments": [
    { "agent": "content|ads|sales|intelligence|all", "task": "việc cụ thể", "priority": "high|medium|low" }
  ]
}

3-5 assignments, mỗi cái rõ ràng (vd: "Content: tạo 5 bài về triệt lông bikini", "Ads: scale-up campaign X 20%", "Sales: ping 10 lead nóng nhất").
agent values phải đúng enum.
Chỉ trả JSON.`;

  let ceoSummary = council.synthesis.slice(0, 400);
  let assignments: Assignment[] = [];

  try {
    const raw = await generateContent(formatPrompt, "Bạn format JSON. Trả JSON hợp lệ.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { ceoSummary?: string; assignments?: Assignment[] };
      if (parsed.ceoSummary) ceoSummary = parsed.ceoSummary;
      if (parsed.assignments) assignments = parsed.assignments.slice(0, 6);
    }
  } catch { /* fallback */ }

  return {
    date: dateStr,
    subReports,
    ceoSummary,
    assignments,
    debate: council.turns.map((t) => ({ speaker: t.speaker, content: t.content, provider: t.provider })),
  };
}
