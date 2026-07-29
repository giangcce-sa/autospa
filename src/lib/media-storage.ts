import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { resolveMediaStoragePolicy } from "@/lib/media-storage-policy";

const STORAGE_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "media");

function storagePolicy() {
  const policy = resolveMediaStoragePolicy();
  if (!policy.allowed) throw new Error(policy.blocker ?? "Media storage chưa sẵn sàng");
  return policy;
}

function s3Config() {
  const bucket = process.env.MEDIA_S3_BUCKET;
  if (!bucket) throw new Error("MEDIA_S3_BUCKET chưa được cấu hình");
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY;
  const client = new S3Client({
    region: process.env.MEDIA_S3_REGION || "auto",
    endpoint: process.env.MEDIA_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === "true",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
  return { bucket, client };
}

function safeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) {
    throw new Error("Media key không hợp lệ");
  }
  return normalized;
}

function absolutePath(key: string) {
  const resolved = path.resolve(STORAGE_ROOT, safeKey(key));
  if (!resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)) throw new Error("Media key vượt ngoài storage");
  return resolved;
}

export function mediaUrl(key: string) {
  return `/api/media/${safeKey(key).split("/").map(encodeURIComponent).join("/")}`;
}

function mediaSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET chưa được cấu hình cho signed media URL");
  return secret;
}

function mediaSignature(key: string, expires: number) {
  return createHmac("sha256", mediaSecret()).update(`${safeKey(key)}:${expires}`).digest("hex");
}

export function signedMediaUrl(key: string, ttlSeconds = 900) {
  const expires = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 60), 3600);
  const normalized = safeKey(key);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const encoded = normalized.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/api/media-public/${encoded}?expires=${expires}&sig=${mediaSignature(normalized, expires)}`;
}

export function verifyMediaSignature(key: string, expires: number, signature: string) {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 3700) return false;
  const expected = mediaSignature(key, expires);
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export function storageKeyFromMediaUrl(url: string) {
  if (!url.startsWith("/api/media/")) return null;
  return safeKey(decodeURIComponent(url.slice("/api/media/".length)));
}

export async function saveMedia(input: {
  folder: string;
  buffer: Buffer;
  extension: string;
}) {
  const folder = safeKey(input.folder);
  const extension = input.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const key = `${folder}/${Date.now()}-${randomUUID()}.${extension}`;
  if (storagePolicy().provider === "s3") {
    const { bucket, client } = s3Config();
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.buffer,
      ContentType: contentTypeForKey(key),
      CacheControl: "private, max-age=300",
    }));
    return { key, url: mediaUrl(key) };
  }
  const target = absolutePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.buffer);
  return { key, url: mediaUrl(key) };
}

export async function readMedia(key: string) {
  if (storagePolicy().provider === "s3") {
    const { bucket, client } = s3Config();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
    if (!response.Body) throw new Error("S3 không trả về nội dung ảnh");
    return Buffer.from(await response.Body.transformToByteArray());
  }
  return readFile(absolutePath(key));
}

export async function deleteMedia(key?: string | null) {
  if (!key) return;
  if (storagePolicy().provider === "s3") {
    const { bucket, client } = s3Config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
    return;
  }
  await rm(absolutePath(key), { force: true });
}

export function contentTypeForKey(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".srt") return "application/x-subrip";
  return "application/octet-stream";
}

export async function imageSourceToBuffer(source: string, storageKey?: string | null) {
  if (storageKey) return readMedia(storageKey);
  if (source.startsWith("data:")) {
    const comma = source.indexOf(",");
    if (comma < 0) throw new Error("Data URL ảnh không hợp lệ");
    return Buffer.from(source.slice(comma + 1), "base64");
  }
  if (source.startsWith("/uploads/")) {
    const legacy = path.resolve(process.cwd(), "public", source.replace(/^\/+/, ""));
    return readFile(legacy);
  }
  if (source.startsWith("/api/media/")) {
    return readMedia(decodeURIComponent(source.slice("/api/media/".length)));
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Không tải được ảnh (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function persistImageSource(source: string, folder = "generated") {
  const buffer = await imageSourceToBuffer(source);
  const signature = buffer.subarray(0, 12).toString("hex");
  const extension = signature.startsWith("89504e47") ? "png" : signature.startsWith("52494646") ? "webp" : "jpg";
  return saveMedia({ folder, buffer, extension });
}
