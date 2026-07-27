import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { parseCanonicalAutomationRequest, toAutomationSettingsDto } from "@/lib/settings/automation-policy";
import { persistSettingsPatch } from "@/lib/settings/persistence";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const patch = parseCanonicalAutomationRequest(await req.json());
    const settings = await persistSettingsPatch(patch, {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=automation&scope=account",
      source: "automation_settings_api",
      title: "Đã cập nhật cấu hình tự động hóa",
    });

    return NextResponse.json({ success: true, data: toAutomationSettingsDto(settings) });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình tự động hóa không hợp lệ");
  }
}
