import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
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
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? "Cấu hình hình ảnh không hợp lệ"
      : error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: error instanceof ZodError ? 400 : 500 });
  }
}
