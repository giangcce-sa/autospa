import sharp from "sharp";
import { prisma } from "@/lib/db";
import { imageSourceToBuffer, readMedia } from "@/lib/media-storage";
import { accessErrorResponse, AccessError, requirePageAccess } from "@/lib/page-access";
import { fetchSafeMedia } from "@/lib/video-studio/media-security";

async function thumbnailSource(imageUrl: string, storageKey: string | null) {
  if (storageKey) return readMedia(storageKey);
  if (imageUrl.startsWith("/api/media/") || imageUrl.startsWith("/uploads/") || imageUrl.startsWith("data:")) {
    return imageSourceToBuffer(imageUrl);
  }
  return fetchSafeMedia(imageUrl, {
    maxBytes: 20 * 1024 * 1024,
    allowedTypes: ["image/png", "image/jpeg", "image/webp"],
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const generation = await prisma.imageGeneration.findUnique({
      where: { id },
      select: { imageUrl: true, storageKey: true, facebookPageId: true },
    });
    if (!generation) throw new AccessError("Không tìm thấy ảnh", 404);
    await requirePageAccess(generation.facebookPageId);

    const input = await thumbnailSource(generation.imageUrl, generation.storageKey);
    const thumbnail = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();

    return new Response(new Uint8Array(thumbnail), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return Response.json({ success: false, error: "Không tạo được thumbnail" }, { status: 404 });
  }
}
