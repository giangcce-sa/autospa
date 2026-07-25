import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { saveConnectionSettings, testConnectionSettings } from "@/lib/settings/connections";
import { SpaUrlError } from "@/lib/spa-url-security";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const data = await saveConnectionSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=connections&scope=account",
      source: "connection_settings_api",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return connectionErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testConnectionSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return connectionErrorResponse(error);
  }
}

function connectionErrorResponse(error: unknown) {
  const access = accessErrorResponse(error);
  if (access) return access;
  const message = error instanceof ZodError
    ? error.issues[0]?.message ?? "Cấu hình kết nối không hợp lệ"
    : error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { success: false, error: message, message },
    { status: error instanceof ZodError || error instanceof SpaUrlError ? 400 : 500 },
  );
}
