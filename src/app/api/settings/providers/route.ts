import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
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
    return settingsErrorResponse(error, "Cấu hình provider không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testProviderSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình provider không hợp lệ");
  }
}
