// Google OAuth callback — saves tokens and discovers GBP account/location
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeGoogleCode, listGbpAccounts, listGbpLocations } from "@/lib/google-business";
import { auth } from "@/lib/auth";
import { clearOAuthStateCookie, GOOGLE_OAUTH_STATE_COOKIE, isValidOAuthState } from "@/lib/oauth-state";

function appUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return new URL(path, baseUrl);
}

function redirectAndClearState(path: string) {
  const res = NextResponse.redirect(appUrl(path));
  clearOAuthStateCookie(res, GOOGLE_OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (!isValidOAuthState(req, GOOGLE_OAUTH_STATE_COOKIE, state)) {
    return redirectAndClearState("/settings?google=error&reason=invalid_state");
  }

  if (error || !code) {
    return redirectAndClearState(`/settings?google=error&reason=${encodeURIComponent(error ?? "no_code")}`);
  }

  const session = await auth();
  if (!session?.user) {
    return redirectAndClearState("/login?from=/settings");
  }
  if ((session.user as { role?: string }).role !== "owner") {
    return redirectAndClearState("/settings?google=error&reason=forbidden");
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Discover GBP account + first location
    let accountId: string | undefined;
    let locationId: string | undefined;
    let locationName: string | undefined;

    try {
      const accounts = await listGbpAccounts(tokens.accessToken);
      if (accounts.length > 0) {
        accountId = accounts[0].name;
        const locations = await listGbpLocations(accountId, tokens.accessToken);
        if (locations.length > 0) {
          locationId = locations[0].name;
          locationName = locations[0].title;
        }
      }
    } catch { /* locations may not be configured yet */ }

    await prisma.googleAccount.upsert({
      where: { email: tokens.email },
      update: {
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken && { refreshToken: tokens.refreshToken }),
        expiresAt,
        displayName: tokens.displayName,
        ...(accountId && { accountId }),
        ...(locationId && { locationId }),
        ...(locationName && { locationName }),
        isActive: true,
      },
      create: {
        email: tokens.email,
        displayName: tokens.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        expiresAt,
        accountId: accountId || null,
        locationId: locationId || null,
        locationName: locationName || null,
        isActive: true,
      },
    });

    const name = encodeURIComponent(locationName ?? tokens.email);
    return redirectAndClearState(`/settings?google=connected&name=${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return redirectAndClearState(`/settings?google=error&reason=${encodeURIComponent(msg)}`);
  }
}
