// TikTok OAuth callback handler
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeTikTokCode, getTikTokUser } from "@/lib/tiktok";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/settings?tiktok=error&reason=${error ?? "no_code"}`, req.url));
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

    return NextResponse.redirect(new URL(`/settings?tiktok=connected&name=${encodeURIComponent(user.displayName)}`, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(new URL(`/settings?tiktok=error&reason=${encodeURIComponent(msg)}`, req.url));
  }
}
