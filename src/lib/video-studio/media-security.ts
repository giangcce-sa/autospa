import "server-only";

import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { runFfprobe } from "./ffmpeg";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata.aws.internal"]);

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19));
}

function privateIp(address: string) {
  if (isIP(address) === 4) return privateIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return privateIpv4(normalized.slice(7));
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export async function assertSafeRemoteUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Media bên ngoài bắt buộc dùng HTTPS");
  if (url.username || url.password) throw new Error("Media URL không được chứa thông tin đăng nhập");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Media URL trỏ tới host nội bộ");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => privateIp(item.address))) throw new Error("Media URL phân giải tới địa chỉ mạng riêng");
  return url;
}

export async function assertSafeProviderBaseUrl(provider: "runway" | "elevenLabs" | "sync", value: string) {
  const url = await assertSafeRemoteUrl(value);
  const defaults: Record<typeof provider, string[]> = {
    runway: ["api.dev.runwayml.com"],
    elevenLabs: ["api.elevenlabs.io"],
    sync: ["api.sync.so"],
  };
  const custom = (process.env.VIDEO_PROVIDER_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  const allowed = [...defaults[provider], ...custom];
  if (!allowed.includes(url.hostname.toLowerCase())) throw new Error(`Base URL ${provider} chưa nằm trong VIDEO_PROVIDER_ALLOWED_HOSTS`);
  return url.toString().replace(/\/$/, "");
}

export async function fetchSafeMedia(value: string, options: { maxBytes: number; allowedTypes?: string[]; allowedHosts?: string[] }, redirects = 0): Promise<Buffer> {
  const url = await assertSafeRemoteUrl(value);
  if (options.allowedHosts?.length && !options.allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("Media URL chưa nằm trong danh sách host được phép");
  }
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(120_000) });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 3) throw new Error("Media URL chuyển hướng quá nhiều lần");
    const location = response.headers.get("location");
    if (!location) throw new Error("Media redirect thiếu Location");
    return fetchSafeMedia(new URL(location, url).toString(), options, redirects + 1);
  }
  if (!response.ok || !response.body) throw new Error(`Không tải được media (${response.status})`);
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (options.allowedTypes?.length && (!contentType || !options.allowedTypes.includes(contentType))) throw new Error(`Media trả về Content-Type không hợp lệ: ${contentType || "unknown"}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > options.maxBytes) throw new Error("Media bên ngoài vượt giới hạn dung lượng");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    total += chunk.byteLength;
    if (total > options.maxBytes) {
      await reader.cancel();
      throw new Error("Media bên ngoài vượt giới hạn dung lượng");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export function mediaChecksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function assertMediaSignature(buffer: Buffer, mimeType: string) {
  if (buffer.length < 12) throw new Error("File media quá ngắn hoặc bị hỏng");
  const hex = buffer.subarray(0, 16).toString("hex");
  const ascii = buffer.subarray(0, 16).toString("ascii");
  const valid = mimeType === "video/mp4" || mimeType === "video/quicktime" || mimeType === "audio/mp4"
    ? ascii.slice(4, 8) === "ftyp"
    : mimeType === "video/webm"
      ? hex.startsWith("1a45dfa3")
      : mimeType === "audio/wav" || mimeType === "audio/x-wav"
        ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE"
        : mimeType === "audio/mpeg"
          ? ascii.startsWith("ID3") || buffer[0] === 0xff
          : false;
  if (!valid) throw new Error("Nội dung file không khớp với định dạng khai báo");
}

export async function probeMediaBuffer(buffer: Buffer, extension: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "autospa-probe-"));
  const file = path.join(dir, `input.${extension}`);
  try {
    await writeFile(file, buffer);
    const output = await runFfprobe(["-v", "error", "-show_entries", "format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,sample_rate,channels", "-of", "json", file]);
    const data = JSON.parse(output) as { format?: { duration?: string; size?: string; format_name?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; sample_rate?: string; channels?: number }> };
    const duration = Number(data.format?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Không đọc được thời lượng media");
    const video = data.streams?.find((stream) => stream.codec_type === "video");
    if (video && ((video.width || 0) > 3840 || (video.height || 0) > 3840)) throw new Error("Video vượt độ phân giải tối đa 4K");
    if (duration > 1800) throw new Error("Media dài quá 30 phút");
    return { duration, format: data.format?.format_name, streams: data.streams || [], width: video?.width, height: video?.height };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function validateSceneMediaUrl(value: string | null | undefined) {
  if (!value) return value;
  if (value.startsWith("/api/media/") || value.startsWith("/uploads/")) return value;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("URL cảnh phải là media nội bộ hoặc HTTPS");
  return value;
}
