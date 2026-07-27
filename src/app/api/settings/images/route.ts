import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { saveImageSettings } from "@/lib/settings/providers";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const data = await saveImageSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=images&scope=account",
      source: "image_settings_api",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình hình ảnh không hợp lệ");
  }
}
