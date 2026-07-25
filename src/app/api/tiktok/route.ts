import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTikTokOAuthUrl, getTikTokUser } from "@/lib/tiktok";
import { createOAuthState, setOAuthStateCookie, TIKTOK_OAUTH_STATE_COOKIE } from "@/lib/oauth-state";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "auth-url") {
      await requireUser({ owner: true });
      const state = createOAuthState();
      const url = getTikTokOAuthUrl(state);
      const res = NextResponse.json({ success: true, data: { url } });
      setOAuthStateCookie(res, TIKTOK_OAUTH_STATE_COOKIE, state);
      return res;
    }

    if (action === "accounts") {
      const accounts = await prisma.tikTokAccount.findMany({
        select: { id: true, openId: true, displayName: true, avatarUrl: true, isActive: true, expiresAt: true },
      });
      return NextResponse.json({ success: true, data: accounts });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
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
      const { accessToken, openId } = body;
      if (!accessToken || !openId) {
        return NextResponse.json({ success: false, message: "Cần accessToken và openId" }, { status: 400 });
      }

      const user = await getTikTokUser(accessToken, openId);
      if (user.openId !== openId) {
        return NextResponse.json({ success: false, message: "Open ID không khớp với access token" }, { status: 400 });
      }

      await prisma.tikTokAccount.upsert({
        where: { openId: user.openId },
        update: { accessToken, displayName: user.displayName, avatarUrl: user.avatarUrl, isActive: true },
        create: { openId: user.openId, displayName: user.displayName, avatarUrl: user.avatarUrl, accessToken, isActive: true },
      });

      return NextResponse.json({ success: true, data: user });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
