import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { deleteMedia, saveMedia } from "@/lib/media-storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Thiếu file ảnh" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "Chỉ hỗ trợ JPG, PNG hoặc WebP" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "Ảnh quá lớn, tối đa 8MB" }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ success: false, error: "File ảnh không hợp lệ" }, { status: 400 });
    }

    let pipeline = sharp(input).rotate().resize({
      width: 1400,
      height: 1400,
      fit: "inside",
      withoutEnlargement: true,
    });
    const extension = file.type === "image/png" ? "png" : "webp";
    if (extension === "png") {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else {
      pipeline = pipeline.webp({ quality: 86 });
    }
    const output = await pipeline.toBuffer();
    const stored = await saveMedia({ folder: "staff-visuals", buffer: output, extension });

    return NextResponse.json({
      success: true,
      data: {
        url: stored.url,
        storageKey: stored.key,
        width: metadata.width,
        height: metadata.height,
        size: output.length,
      },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { storageKey } = await req.json();
    if (typeof storageKey !== "string" || !storageKey.startsWith("staff-visuals/")) {
      return NextResponse.json({ success: false, error: "Storage key không hợp lệ" }, { status: 400 });
    }
    await deleteMedia(storageKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
