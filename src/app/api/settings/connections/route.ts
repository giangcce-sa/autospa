import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { saveConnectionSettings, testConnectionSettings } from "@/lib/settings/connections";

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
    return settingsErrorResponse(error, "Cấu hình kết nối không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testConnectionSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình kết nối không hợp lệ");
  }
}
