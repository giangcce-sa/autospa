import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "staff-visuals");

function extForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
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

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = extForType(file.type);
    const filename = `${Date.now()}-${randomUUID()}.${ext === "png" ? "png" : "webp"}`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    let pipeline = sharp(input).rotate().resize({
      width: 1400,
      height: 1400,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (ext === "png") {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else {
      pipeline = pipeline.webp({ quality: 86 });
    }
    const output = await pipeline.toBuffer();
    await writeFile(outputPath, output);

    return NextResponse.json({
      success: true,
      data: {
        url: `/uploads/staff-visuals/${filename}`,
        filename,
        width: metadata.width,
        height: metadata.height,
        size: output.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
