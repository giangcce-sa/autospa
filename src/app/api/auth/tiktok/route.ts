// TikTok OAuth callback handler
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeTikTokCode, getTikTokUser } from "@/lib/tiktok";
import { auth } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets-crypto";
import { clearOAuthStateCookie, isValidOAuthState, TIKTOK_OAUTH_STATE_COOKIE } from "@/lib/oauth-state";

function appUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return new URL(path, baseUrl);
}

function redirectAndClearState(path: string) {
  const res = NextResponse.redirect(appUrl(path));
  clearOAuthStateCookie(res, TIKTOK_OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (!isValidOAuthState(req, TIKTOK_OAUTH_STATE_COOKIE, state)) {
    return redirectAndClearState("/settings?tiktok=error&reason=invalid_state");
  }

  if (error || !code) {
    return redirectAndClearState(`/settings?tiktok=error&reason=${encodeURIComponent(error ?? "no_code")}`);
  }

  const session = await auth();
  if (!session?.user) {
    return redirectAndClearState("/login?from=/settings");
  }
  if ((session.user as { role?: string }).role !== "owner") {
    return redirectAndClearState("/settings?tiktok=error&reason=forbidden");
  }

  try {
    const tokens = await exchangeTikTokCode(code);
    const user = await getTikTokUser(tokens.accessToken, tokens.openId);

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const storedAccessToken = encryptSecret(tokens.accessToken);
    const storedRefreshToken = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : tokens.refreshToken;
    await prisma.tikTokAccount.upsert({
      where: { openId: tokens.openId },
      update: {
        accessToken: storedAccessToken,
        refreshToken: storedRefreshToken,
        expiresAt,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isActive: true,
      },
      create: {
        openId: tokens.openId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        accessToken: storedAccessToken,
        refreshToken: storedRefreshToken,
        expiresAt,
        isActive: true,
      },
    });

    return redirectAndClearState(`/settings?tiktok=connected&name=${encodeURIComponent(user.displayName)}`);
  } catch (e) {
    console.error("tiktok oauth exchange failed:", e);
    return redirectAndClearState("/settings?tiktok=error&reason=exchange_failed");
  }
}
