import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { getListeningIntelligence } from "@/lib/growth-intelligence";
import { AccessError, accessErrorResponse, requireUser } from "@/lib/page-access";

const ALERT_TYPES = new Set(["review_negative", "crisis", "trending", "mention"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

export async function GET() {
  try {
    await requireUser();
    const data = await getListeningIntelligence();
    return NextResponse.json({ data, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const action = body.action;

    if (action === "analyze") {
      const content = requiredText(body.content, "Nội dung").slice(0, 5_000);
      const source = optionalText(body.source)?.slice(0, 100) ?? "manual";
      const analysis = await generateContent(
        `Phân tích nội dung này từ mạng xã hội:\n"${content}"\n\nXác định:\n1. Loại cảnh báo: review_negative / crisis / trending / mention\n2. Mức độ nghiêm trọng: low / medium / high / critical\n3. Tóm tắt vấn đề trong 1 câu\n\nTrả lời theo JSON: {"type":"...","severity":"...","summary":"..."}\nChỉ JSON, không giải thích.`,
        "Bạn là chuyên gia phân tích mạng xã hội cho spa.",
      );
      const parsed = parseAnalysis(analysis, content);
      const alert = await prisma.socialAlert.create({
        data: { type: parsed.type, content: parsed.summary, source, severity: parsed.severity },
        select: alertSelect,
      });
      return NextResponse.json({ data: serializeAlert(alert), success: true });
    }

    if (action === "simulate") {
      const samples = [
        { content: "Spa này massage tệ quá, nhân viên không chuyên nghiệp!", source: "Google Review", severity: "high", type: "review_negative" },
        { content: "Ai đã thử dịch vụ ở đây chưa? Mình đang tìm spa tốt", source: "Facebook Group", severity: "low", type: "mention" },
        { content: "CẢNH BÁO: Spa lừa đảo, thu tiền không làm dịch vụ!", source: "Facebook", severity: "critical", type: "crisis" },
        { content: "Trend massage đá nóng đang hot, nhiều người tìm kiếm", source: "TikTok", severity: "low", type: "trending" },
        { content: "Khách hàng phàn nàn về giờ chờ quá lâu", source: "Inbox", severity: "medium", type: "review_negative" },
      ];
      const alert = await prisma.socialAlert.create({
        data: samples[Math.floor(Math.random() * samples.length)],
        select: alertSelect,
      });
      return NextResponse.json({ data: serializeAlert(alert), success: true });
    }

    if (action === "mark-read") {
      await prisma.socialAlert.update({ where: { id: requiredId(body.id) }, data: { isRead: true }, select: { id: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "mark-all-read") {
      const result = await prisma.socialAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
      return NextResponse.json({ data: { updated: result.count }, success: true });
    }

    if (action === "suggest-response") {
      const alert = await prisma.socialAlert.findUnique({ where: { id: requiredId(body.id) }, select: alertSelect });
      if (!alert) throw new AccessError("Không tìm thấy cảnh báo", 404);
      const response = await generateContent(
        `Cảnh báo mạng xã hội: "${alert.content}" (nguồn: ${alert.source}, loại: ${alert.type})\nHãy gợi ý cách phản hồi/xử lý khủng hoảng này cho spa một cách chuyên nghiệp, bình tĩnh. Dưới 120 chữ. Đây chỉ là đề xuất, không tuyên bố đã gửi phản hồi.`,
        "Bạn là chuyên gia PR cho spa.",
      );
      return NextResponse.json({ data: { response }, success: true });
    }

    throw new AccessError("Action không hợp lệ", 400);
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), success: false }, { status: 500 });
  }
}

const alertSelect = {
  id: true,
  type: true,
  content: true,
  source: true,
  severity: true,
  isRead: true,
  createdAt: true,
} as const;

type SelectedAlert = Prisma.SocialAlertGetPayload<{ select: typeof alertSelect }>;

function serializeAlert(alert: SelectedAlert) {
  return { ...alert, createdAt: alert.createdAt.toISOString() };
}

function parseAnalysis(raw: string, fallbackContent: string) {
  let parsed: { type?: unknown; severity?: unknown; summary?: unknown } = {};
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? "{}");
  } catch {
    parsed = {};
  }
  const type = typeof parsed.type === "string" && ALERT_TYPES.has(parsed.type) ? parsed.type : "mention";
  const severity = typeof parsed.severity === "string" && SEVERITIES.has(parsed.severity) ? parsed.severity : "low";
  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim().slice(0, 500) : fallbackContent.slice(0, 200);
  return { type, severity, summary };
}

function requiredId(value: unknown) {
  return requiredText(value, "ID");
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new AccessError(`${label} không được trống`, 400);
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
