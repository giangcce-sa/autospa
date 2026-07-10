import { prisma } from "@/lib/db";
import { getVisualProfile } from "@/lib/visual-profile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    const profile = await getVisualProfile(facebookPageId);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, autoApply } = await req.json();
    if (!id || typeof autoApply !== "boolean") {
      return NextResponse.json({ success: false, error: "Thiếu id hoặc autoApply" }, { status: 400 });
    }
    const profile = await prisma.visualProfile.update({
      where: { id },
      data: { autoApply },
    });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
