// TikTok OAuth callback handler
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeTikTokCode, getTikTokUser } from "@/lib/tiktok";
import { auth } from "@/lib/auth";
import { clearOAuthStateCookie, isValidOAuthState, TIKTOK_OAUTH_STATE_COOKIE } from "@/lib/oauth-state";

function appUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return new URL(path, baseUrl);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(appUrl(`/settings?tiktok=error&reason=${error ?? "no_code"}`));
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(appUrl("/login?from=/settings"));
  }

  if (!isValidOAuthState(req, TIKTOK_OAUTH_STATE_COOKIE, state)) {
    const res = NextResponse.redirect(appUrl("/settings?tiktok=error&reason=invalid_state"));
    clearOAuthStateCookie(res, TIKTOK_OAUTH_STATE_COOKIE);
    return res;
  }

  try {
    const tokens = await exchangeTikTokCode(code);
    const user = await getTikTokUser(tokens.accessToken, tokens.openId);

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await prisma.tikTokAccount.upsert({
      where: { openId: tokens.openId },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isActive: true,
      },
      create: {
        openId: tokens.openId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        isActive: true,
      },
    });

    const res = NextResponse.redirect(appUrl(`/settings?tiktok=connected&name=${encodeURIComponent(user.displayName)}`));
    clearOAuthStateCookie(res, TIKTOK_OAUTH_STATE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const res = NextResponse.redirect(appUrl(`/settings?tiktok=error&reason=${encodeURIComponent(msg)}`));
    clearOAuthStateCookie(res, TIKTOK_OAUTH_STATE_COOKIE);
    return res;
  }
}
