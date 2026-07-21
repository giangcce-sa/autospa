import { prisma } from "@/lib/db";
import { getVisualProfile } from "@/lib/visual-profile";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const profile = await getVisualProfile(facebookPageId);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, autoApply, facebookPageId } = await req.json();
    if (!id || typeof autoApply !== "boolean") {
      return NextResponse.json({ success: false, error: "Thiếu id hoặc autoApply" }, { status: 400 });
    }
    await requirePageAccess(facebookPageId || null, { owner: true });
    const existing = await prisma.visualProfile.findFirst({ where: { id, facebookPageId: facebookPageId || null } });
    if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy Visual Profile trong Page này" }, { status: 404 });
    const profile = await prisma.visualProfile.update({
      where: { id: existing.id },
      data: { autoApply },
    });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
