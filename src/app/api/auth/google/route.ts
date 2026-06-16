// Google OAuth callback — saves tokens and discovers GBP account/location
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeGoogleCode, listGbpAccounts, listGbpLocations } from "@/lib/google-business";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/settings?google=error&reason=${error ?? "no_code"}`, req.url));
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
    return NextResponse.redirect(new URL(`/settings?google=connected&name=${name}`, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(new URL(`/settings?google=error&reason=${encodeURIComponent(msg)}`, req.url));
  }
}
