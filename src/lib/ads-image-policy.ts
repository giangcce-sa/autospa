export const MAX_AD_IMAGE_BYTES = 10 * 1024 * 1024;

export function inspectAdsImageBuffer(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_AD_IMAGE_BYTES) {
    throw new Error("Ảnh quảng cáo vượt giới hạn 10 MB");
  }
  const hex = buffer.subarray(0, 16).toString("hex");
  const ascii = buffer.subarray(0, 16).toString("ascii");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  throw new Error("Ảnh quảng cáo không đúng định dạng PNG, JPEG hoặc WebP");
}

export function adsMediaHostAllowed(hostname: string, allowedHosts: string[]) {
  return allowedHosts.includes(hostname.toLowerCase());
}
