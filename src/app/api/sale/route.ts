import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { updatedAt: "desc" } });
    const stats = {
      total: await prisma.lead.count(),
      hot: await prisma.lead.count({ where: { stage: "hot" } }),
      warm: await prisma.lead.count({ where: { stage: "warm" } }),
      cold: await prisma.lead.count({ where: { stage: "cold" } }),
      closed: await prisma.lead.count({ where: { stage: "closed" } }),
    };
    return NextResponse.json({ data: { leads, stats } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const lead = await prisma.lead.create({
        data: { name: body.name, phone: body.phone, source: body.source || "facebook", service: body.service, stage: body.stage || "cold", score: body.score || 0, note: body.note },
      });
      return NextResponse.json({ data: lead });
    }

    if (action === "update-stage") {
      const lead = await prisma.lead.update({ where: { id: body.id }, data: { stage: body.stage, lastAction: body.note, updatedAt: new Date() } });
      return NextResponse.json({ data: lead });
    }

    if (action === "ai-score") {
      const { name, service, source, note } = body;
      const result = await generateContent(
        `Khách hàng tiềm năng:\n- Tên: ${name}\n- Dịch vụ quan tâm: ${service || "chưa rõ"}\n- Nguồn: ${source || "facebook"}\n- Ghi chú: ${note || "không có"}\n\nĐánh giá lead score (0-100) và giai đoạn (cold/warm/hot) dựa trên mức độ quan tâm. Trả lời JSON: {"score":70,"stage":"warm","reason":"..."}\nChỉ JSON.`,
        "Bạn là chuyên gia sales cho spa."
      );
      let parsed = { score: 50, stage: "warm", reason: "Không xác định" };
      try {
        const match = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match?.[0] || "{}");
      } catch {}
      return NextResponse.json({ data: parsed });
    }

    if (action === "consult-script") {
      const { name, service, stage } = body;
      const script = await generateContent(
        `Khách hàng "${name}" quan tâm dịch vụ "${service || "spa"}", hiện đang ở giai đoạn ${stage === "cold" ? "lạnh - chưa quan tâm lắm" : stage === "warm" ? "ấm - có quan tâm" : "nóng - sắp quyết định"}.\n\nViết kịch bản tư vấn ngắn gọn (3-4 bước) để chốt sale, phù hợp với spa cao cấp. Thực tế, thuyết phục, không sáo rỗng. Dưới 200 chữ.`,
        "Bạn là chuyên gia tư vấn bán hàng spa."
      );
      return NextResponse.json({ data: { script } });
    }

    if (action === "delete") {
      await prisma.lead.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
