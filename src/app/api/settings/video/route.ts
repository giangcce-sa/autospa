import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { saveVideoSettings, testVideoProviderSettings } from "@/lib/settings/video";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const data = await saveVideoSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=video&scope=account",
      source: "video_settings_api",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình video không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testVideoProviderSettings(await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình video không hợp lệ", 502);
  }
}
