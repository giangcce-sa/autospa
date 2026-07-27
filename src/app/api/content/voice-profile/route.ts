import { prisma } from "@/lib/db";
import { AccessError, requireExplicitPageAccess, requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  id: z.string().trim().min(1),
  autoApply: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    const { page } = await requireExplicitPageAccess(facebookPageId);
    const profile = await prisma.humanVoiceProfile.findUnique({ where: { facebookPageId: page!.id } });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return routeErrorResponse(error, "Không thể tải Voice Profile");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, autoApply } = updateSchema.parse(await req.json());
    const profile = await prisma.humanVoiceProfile.findUnique({ where: { id } });
    if (!profile) throw new AccessError("Không tìm thấy Voice Profile", 404);
    if (!profile.facebookPageId) throw new AccessError("Voice Profile chưa xác định được Facebook Page", 409);
    await requirePageAccess(profile.facebookPageId, { owner: true });
    if (autoApply && profile.approvedEdits < 3) {
      return NextResponse.json({ success: false, error: "Cần ít nhất 3 bản chỉnh sửa đã xác nhận" }, { status: 400 });
    }
    const updated = await prisma.humanVoiceProfile.update({ where: { id }, data: { autoApply } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error, "Không thể cập nhật Voice Profile");
  }
}
