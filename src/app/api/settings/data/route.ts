import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { parseCanonicalDataSettingsRequest, toDataSettingsDto } from "@/lib/settings/data-policy";
import { persistSettingsPatch } from "@/lib/settings/persistence";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const patch = parseCanonicalDataSettingsRequest(await req.json());
    const settings = await persistSettingsPatch(patch, {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=data&scope=account",
      source: "data_settings_api",
      title: "Đã cập nhật chính sách lưu trữ dữ liệu",
    });
    return NextResponse.json({ success: true, data: toDataSettingsDto(settings) });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình dữ liệu không hợp lệ");
  }
}
