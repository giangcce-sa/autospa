import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function equalSecret(provided: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth && equalSecret(auth, `Bearer ${secret}`)) return null;
  if (
    !secret
    && process.env.NODE_ENV !== "production"
    && process.env.ALLOW_INSECURE_DEV_CRON === "true"
  ) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
