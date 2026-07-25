import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { ProviderUrlError } from "@/lib/provider-url-security";
import { saveProviderSettings, testProviderSettings } from "@/lib/settings/providers";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const data = await saveProviderSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=providers&scope=account",
      source: "provider_settings_api",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return providerErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testProviderSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return providerErrorResponse(error);
  }
}

function providerErrorResponse(error: unknown) {
  const access = accessErrorResponse(error);
  if (access) return access;
  const message = error instanceof ZodError
    ? error.issues[0]?.message ?? "Cấu hình provider không hợp lệ"
    : error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { success: false, error: message, message },
    { status: error instanceof ZodError || error instanceof ProviderUrlError ? 400 : 500 },
  );
}
