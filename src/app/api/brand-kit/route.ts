import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    const kit = await prisma.brandKit.findFirst({
      where: { facebookPageId },
    });
    return NextResponse.json({ data: kit, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { facebookPageId: rawPageId, logoUrl, primaryColor, accentColor, fontStyle, spaName, tagline } = body;
    const facebookPageId = rawPageId || null;
    const kit = await prisma.brandKit.upsert({
      where: { facebookPageId },
      create: {
        facebookPageId,
        logoUrl,
        primaryColor: primaryColor ?? "#2d6a4f",
        accentColor: accentColor ?? "#40c074",
        fontStyle: fontStyle ?? "elegant",
        spaName,
        tagline,
      },
      update: { logoUrl, primaryColor, accentColor, fontStyle, spaName, tagline },
    });
    return NextResponse.json({ data: kit, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi lưu", success: false }, { status: 500 });
  }
}
