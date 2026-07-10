import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
  const profile = await prisma.humanVoiceProfile.findFirst({
    where: { facebookPageId: facebookPageId || null },
  });
  return NextResponse.json({ success: true, data: profile });
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, autoApply } = await req.json();
    const profile = await prisma.humanVoiceProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ success: false, error: "Không tìm thấy Voice Profile" }, { status: 404 });
    }
    if (autoApply === true && profile.approvedEdits < 3) {
      return NextResponse.json({ success: false, error: "Cần ít nhất 3 bản chỉnh sửa đã xác nhận" }, { status: 400 });
    }
    const updated = await prisma.humanVoiceProfile.update({
      where: { id },
      data: { autoApply: Boolean(autoApply) },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
