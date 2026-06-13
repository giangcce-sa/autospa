import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";

export async function GET() {
  try {
    const alerts = await prisma.socialAlert.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const stats = {
      total: await prisma.socialAlert.count(),
      unread: await prisma.socialAlert.count({ where: { isRead: false } }),
      critical: await prisma.socialAlert.count({ where: { severity: "critical" } }),
      high: await prisma.socialAlert.count({ where: { severity: "high" } }),
    };
    return NextResponse.json({ data: { alerts, stats } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "analyze") {
      const { content, source } = body;
      const analysis = await generateContent(
        `Phân tích nội dung này từ mạng xã hội:\n"${content}"\n\nXác định:\n1. Loại cảnh báo: review_negative / crisis / trending / mention\n2. Mức độ nghiêm trọng: low / medium / high / critical\n3. Tóm tắt vấn đề trong 1 câu\n\nTrả lời theo JSON: {"type":"...","severity":"...","summary":"..."}\nChỉ JSON, không giải thích.`,
        "Bạn là chuyên gia phân tích mạng xã hội cho spa."
      );
      let parsed = { type: "mention", severity: "low", summary: content.slice(0, 100) };
      try {
        const match = analysis.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match?.[0] || "{}");
      } catch {}

      const alert = await prisma.socialAlert.create({
        data: { type: parsed.type || "mention", content: parsed.summary || content.slice(0, 200), source: source || "manual", severity: parsed.severity || "low" },
      });
      return NextResponse.json({ data: alert });
    }

    if (action === "simulate") {
      const samples = [
        { content: "Spa này massage tệ quá, nhân viên không chuyên nghiệp!", source: "Google Review", severity: "high", type: "review_negative" },
        { content: "Ai đã thử dịch vụ ở đây chưa? Mình đang tìm spa tốt", source: "Facebook Group", severity: "low", type: "mention" },
        { content: "CẢNH BÁO: Spa lừa đảo, thu tiền không làm dịch vụ!", source: "Facebook", severity: "critical", type: "crisis" },
        { content: "Trend massage đá nóng đang hot, nhiều người tìm kiếm", source: "TikTok", severity: "low", type: "trending" },
        { content: "Khách hàng phàn nàn về giờ chờ quá lâu", source: "Inbox", severity: "medium", type: "review_negative" },
      ];
      const sample = samples[Math.floor(Math.random() * samples.length)];
      const alert = await prisma.socialAlert.create({ data: sample });
      return NextResponse.json({ data: alert });
    }

    if (action === "mark-read") {
      await prisma.socialAlert.update({ where: { id: body.id }, data: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "mark-all-read") {
      await prisma.socialAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "suggest-response") {
      const alert = await prisma.socialAlert.findUnique({ where: { id: body.id } });
      if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const response = await generateContent(
        `Cảnh báo mạng xã hội: "${alert.content}" (nguồn: ${alert.source}, loại: ${alert.type})\nHãy gợi ý cách phản hồi/xử lý khủng hoảng này cho spa một cách chuyên nghiệp, bình tĩnh. Dưới 120 chữ.`,
        "Bạn là chuyên gia PR cho spa."
      );
      return NextResponse.json({ data: { response } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
