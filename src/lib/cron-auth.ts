import { NextRequest, NextResponse } from "next/server";

export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return null;
  // Allow localhost calls without secret (for local dev testing)
  const host = req.headers.get("host") ?? "";
  if (!secret && (host.includes("localhost") || host.includes("127.0.0.1"))) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
