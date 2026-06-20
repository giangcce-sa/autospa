import { randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const GOOGLE_OAUTH_STATE_COOKIE = "autospa_google_oauth_state";
export const TIKTOK_OAUTH_STATE_COOKIE = "autospa_tiktok_oauth_state";

const COOKIE_MAX_AGE_SECONDS = 10 * 60;

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function setOAuthStateCookie(response: NextResponse, name: string, state: string) {
  response.cookies.set(name, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearOAuthStateCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isValidOAuthState(req: NextRequest, cookieName: string, returnedState: string | null): boolean {
  const expectedState = req.cookies.get(cookieName)?.value;
  if (!expectedState || !returnedState) return false;

  const expected = Buffer.from(expectedState);
  const actual = Buffer.from(returnedState);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
