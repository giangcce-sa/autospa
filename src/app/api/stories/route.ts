import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = searchParams.get("facebookPageId") || null;
    const type = searchParams.get("type") || undefined;
    const activeOnly = searchParams.get("active") !== "false";

    const stories = await prisma.spaStory.findMany({
      where: {
        facebookPageId,
        ...(type ? { type } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: stories, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { facebookPageId, type, customerName, content, service, imageUrl } = body;
      if (!content?.trim()) return NextResponse.json({ error: "Nội dung câu chuyện không được để trống", success: false }, { status: 400 });

      const story = await prisma.spaStory.create({
        data: {
          facebookPageId: facebookPageId || null,
          type: type ?? "testimonial",
          customerName: customerName || null,
          content: content.trim(),
          service: service || null,
          imageUrl: imageUrl || null,
        },
      });
      return NextResponse.json({ data: story, success: true });
    }

    if (action === "update") {
      const { id, type, customerName, content, service, imageUrl, isActive } = body;
      const story = await prisma.spaStory.update({
        where: { id },
        data: {
          ...(type !== undefined ? { type } : {}),
          ...(customerName !== undefined ? { customerName: customerName || null } : {}),
          ...(content !== undefined ? { content: content.trim() } : {}),
          ...(service !== undefined ? { service: service || null } : {}),
          ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      return NextResponse.json({ data: story, success: true });
    }

    if (action === "delete") {
      const { id } = body;
      await prisma.spaStory.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
