import { NextRequest, NextResponse } from "next/server";

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return null;
  if (
    !secret
    && process.env.NODE_ENV !== "production"
    && process.env.ALLOW_INSECURE_DEV_CRON === "true"
  ) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
