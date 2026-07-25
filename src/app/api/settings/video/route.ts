import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
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
    return videoErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const result = await testVideoProviderSettings(await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return videoErrorResponse(error, 502);
  }
}

function videoErrorResponse(error: unknown, fallbackStatus = 500) {
  const access = accessErrorResponse(error);
  if (access) return access;
  const message = error instanceof ZodError
    ? error.issues[0]?.message ?? "Cấu hình video không hợp lệ"
    : error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { success: false, error: message, message },
    { status: error instanceof ZodError || message.includes("gateway") || message.includes("Base URL") ? 400 : fallbackStatus },
  );
}
