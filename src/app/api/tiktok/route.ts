import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTikTokOAuthUrl, getTikTokUser } from "@/lib/tiktok";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "auth-url") {
      const state = Math.random().toString(36).slice(2);
      const url = getTikTokOAuthUrl(state);
      return NextResponse.json({ success: true, data: { url, state } });
    }

    if (action === "accounts") {
      const accounts = await prisma.tikTokAccount.findMany({
        select: { id: true, openId: true, displayName: true, avatarUrl: true, isActive: true, expiresAt: true },
      });
      return NextResponse.json({ success: true, data: accounts });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "disconnect") {
      const { id } = body;
      await prisma.tikTokAccount.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle-active") {
      const { id, isActive } = body;
      await prisma.tikTokAccount.update({ where: { id }, data: { isActive } });
      return NextResponse.json({ success: true });
    }

    // Manual token entry (for testing without OAuth flow)
    if (action === "manual-connect") {
      const { accessToken, openId, displayName } = body;
      if (!accessToken || !openId) {
        return NextResponse.json({ success: false, message: "Cần accessToken và openId" }, { status: 400 });
      }

      let user = { openId, displayName: displayName ?? "TikTok Account", avatarUrl: "", followerCount: 0, followingCount: 0, likesCount: 0, videoCount: 0 };
      try {
        user = await getTikTokUser(accessToken, openId);
      } catch { /* use manual info */ }

      await prisma.tikTokAccount.upsert({
        where: { openId: user.openId },
        update: { accessToken, displayName: user.displayName, avatarUrl: user.avatarUrl, isActive: true },
        create: { openId: user.openId, displayName: user.displayName, avatarUrl: user.avatarUrl, accessToken, isActive: true },
      });

      return NextResponse.json({ success: true, data: user });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
