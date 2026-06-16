import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const pages = await prisma.facebookPage.findMany({ orderBy: { createdAt: "asc" } });
    const safe = pages.map((p: { id: string; fbPageId: string; pageName: string; accessToken: string; isActive: boolean; adAccountId: string | null; createdAt: Date }) => ({
      id: p.id,
      fbPageId: p.fbPageId,
      pageName: p.pageName,
      isActive: p.isActive,
      adAccountId: p.adAccountId,
      createdAt: p.createdAt,
      accessTokenHint: "••••••••" + p.accessToken.slice(-4),
    }));
    return NextResponse.json({ data: safe, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { fbPageId, accessToken } = body;
      if (!fbPageId || !accessToken) return NextResponse.json({ success: false, message: "Thiếu Page ID hoặc Access Token" });
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}?fields=name,id&access_token=${accessToken}`);
        const data = await res.json();
        if (data.name) return NextResponse.json({ success: true, message: `Kết nối thành công! Page: ${data.name}`, pageName: data.name });
        return NextResponse.json({ success: false, message: data.error?.message || "Token không hợp lệ" });
      } catch (e) {
        return NextResponse.json({ success: false, message: "Không thể kết nối: " + String(e) });
      }
    }

    if (action === "add") {
      const { fbPageId, pageName, accessToken, adAccountId } = body;
      if (!fbPageId?.trim() || !pageName?.trim() || !accessToken?.trim()) {
        return NextResponse.json({ error: "Thiếu Page ID, tên page hoặc Access Token", success: false }, { status: 400 });
      }
      const adActId = adAccountId?.trim() || null;
      const page = await prisma.facebookPage.upsert({
        where: { fbPageId: fbPageId.trim() },
        create: { fbPageId: fbPageId.trim(), pageName: pageName.trim(), accessToken: accessToken.trim(), adAccountId: adActId },
        update: { pageName: pageName.trim(), accessToken: accessToken.trim(), adAccountId: adActId },
      });
      return NextResponse.json({ data: page, success: true });
    }

    if (action === "update") {
      const { id, pageName, accessToken, adAccountId } = body;
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      const data: Record<string, string | null> = {};
      if (pageName?.trim()) data.pageName = pageName.trim();
      if (accessToken?.trim()) data.accessToken = accessToken.trim();
      if ("adAccountId" in body) data.adAccountId = adAccountId?.trim() || null;
      await prisma.facebookPage.update({ where: { id }, data });
      return NextResponse.json({ success: true });
    }

    if (action === "update-ad-account") {
      const { id, adAccountId } = body;
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      await prisma.facebookPage.update({ where: { id }, data: { adAccountId: adAccountId?.trim() || null } });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      const { id } = body;
      const page = await prisma.facebookPage.findUnique({ where: { id } });
      if (!page) return NextResponse.json({ error: "Không tìm thấy", success: false }, { status: 404 });
      await prisma.facebookPage.update({ where: { id }, data: { isActive: !page.isActive } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
    await prisma.facebookPage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
