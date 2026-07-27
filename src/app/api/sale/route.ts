import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { AccessError, getAuthorizedPageIds, requirePageAccess, requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await requireUser();
    const authorizedPageIds = await getAuthorizedPageIds(user);
    const where = authorizedPageIds
      ? { conversations: { some: { facebookPageId: { in: authorizedPageIds } } } }
      : {};
    const leads = await prisma.lead.findMany({ where, orderBy: { updatedAt: "desc" } });
    const stats = {
      total: await prisma.lead.count({ where }),
      hot: await prisma.lead.count({ where: { ...where, stage: "hot" } }),
      warm: await prisma.lead.count({ where: { ...where, stage: "warm" } }),
      cold: await prisma.lead.count({ where: { ...where, stage: "cold" } }),
      closed: await prisma.lead.count({ where: { ...where, stage: "closed" } }),
    };
    return NextResponse.json({ data: { leads, stats } });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const lead = await prisma.lead.create({
        data: { name: body.name, phone: body.phone, source: body.source || "facebook", service: body.service, stage: body.stage || "cold", score: body.score || 0, note: body.note },
      });
      return NextResponse.json({ data: lead });
    }

    if (action === "update-stage") {
      await requireScopedLead(body.id, body.facebookPageId);
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
      const lead = await requireScopedLead(body.id, body.facebookPageId);
      const script = await generateContent(
        `Khách hàng "${lead.name}" quan tâm dịch vụ "${lead.service || "spa"}", hiện đang ở giai đoạn ${lead.stage === "cold" ? "lạnh - chưa quan tâm lắm" : lead.stage === "warm" ? "ấm - có quan tâm" : "nóng - sắp quyết định"}.\n\nViết kịch bản tư vấn ngắn gọn (3-4 bước) để chốt sale, phù hợp với spa cao cấp. Thực tế, thuyết phục, không sáo rỗng. Dưới 200 chữ.`,
        "Bạn là chuyên gia tư vấn bán hàng spa."
      );
      return NextResponse.json({ data: { script } });
    }

    if (action === "delete") {
      await requireScopedLead(body.id, body.facebookPageId);
      await prisma.lead.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi không xác định");
  }
}

async function requireScopedLead(id: string | undefined, facebookPageId: string | undefined) {
  if (!id) throw new AccessError("Thiếu lead ID", 400);
  if (!facebookPageId) throw new AccessError("Hãy chọn Facebook Page", 400);
  await requirePageAccess(facebookPageId, { owner: true });
  const lead = await prisma.lead.findFirst({
    where: { id, conversations: { some: { facebookPageId } } },
    select: { id: true, name: true, service: true, stage: true },
  });
  if (!lead) throw new AccessError("Lead không thuộc Facebook Page đang chọn", 403);
  return lead;
}
