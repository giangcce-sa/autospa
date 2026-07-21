import "server-only";

import sharp from "sharp";
import { inspectAdsImageBuffer, MAX_AD_IMAGE_BYTES } from "./ads-image-policy";
import { imageSourceToBuffer } from "./media-storage";
import { fetchSafeMedia } from "./video-studio/media-security";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function allowedExternalHosts() {
  return (process.env.ADS_MEDIA_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export async function loadAdsImage(source: string) {
  const internal = source.startsWith("/api/media/") || source.startsWith("/uploads/") || source.startsWith("data:");
  const externalHosts = allowedExternalHosts();
  if (!internal && !externalHosts.length) {
    throw new Error("Chưa cấu hình ADS_MEDIA_ALLOWED_HOSTS cho ảnh quảng cáo bên ngoài");
  }
  const buffer = internal
    ? await imageSourceToBuffer(source)
    : await fetchSafeMedia(source, {
        maxBytes: MAX_AD_IMAGE_BYTES,
        allowedTypes: ALLOWED_IMAGE_TYPES,
        allowedHosts: externalHosts,
      });
  const mimeType = inspectAdsImageBuffer(buffer);
  const metadata = await sharp(buffer, { limitInputPixels: 25_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Không đọc được kích thước ảnh quảng cáo");
  if (metadata.width > 4096 || metadata.height > 4096) throw new Error("Ảnh quảng cáo vượt kích thước 4096px");
  return { buffer, mimeType };
}
