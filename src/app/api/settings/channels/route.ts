import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { getChannelSettings, saveZaloSettings, testZaloSettings } from "@/lib/settings/channels";

export async function GET() {
  try {
    await requireUser({ owner: true });
    return NextResponse.json({ success: true, data: await getChannelSettings() });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình kênh không hợp lệ");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const data = await saveZaloSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=channels&scope=account",
      source: "channel_settings_api",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình kênh không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testZaloSettings(await req.json());
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình kênh không hợp lệ");
  }
}
