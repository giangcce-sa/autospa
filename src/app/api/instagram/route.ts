import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLinkedIgAccount, fetchIgMedia } from "@/lib/instagram";

// GET: list IG accounts linked to FB pages, or fetch IG media
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "media") {
      const facebookPageId = searchParams.get("facebookPageId");
      const page = facebookPageId
        ? await prisma.facebookPage.findUnique({ where: { id: facebookPageId } })
        : await prisma.facebookPage.findFirst({ where: { isActive: true, igAccountId: { not: null } } });

      if (!page?.igAccountId) {
        return NextResponse.json({ success: false, message: "Chưa kết nối Instagram" }, { status: 400 });
      }

      const media = await fetchIgMedia(page.igAccountId, page.accessToken);
      return NextResponse.json({ success: true, data: media });
    }

    // Default: list all FB pages with their IG status
    const pages = await prisma.facebookPage.findMany({
      select: { id: true, pageName: true, fbPageId: true, igAccountId: true, igUsername: true, isActive: true },
    });
    return NextResponse.json({ success: true, data: pages });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

// POST: connect (discover) or disconnect Instagram account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId } = body;

    if (action === "connect") {
      const page = await prisma.facebookPage.findUnique({ where: { id: facebookPageId } });
      if (!page) return NextResponse.json({ success: false, message: "Không tìm thấy Facebook Page" }, { status: 404 });

      const igAccount = await getLinkedIgAccount(page.fbPageId, page.accessToken);
      if (!igAccount) {
        return NextResponse.json({ success: false, message: "Không tìm thấy Instagram Business Account liên kết với trang này. Hãy chắc chắn đã kết nối IG Business trong Facebook Business Manager." }, { status: 400 });
      }

      await prisma.facebookPage.update({
        where: { id: facebookPageId },
        data: { igAccountId: igAccount.id, igUsername: igAccount.username },
      });

      return NextResponse.json({ success: true, data: igAccount });
    }

    if (action === "disconnect") {
      await prisma.facebookPage.update({
        where: { id: facebookPageId },
        data: { igAccountId: null, igUsername: null },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
