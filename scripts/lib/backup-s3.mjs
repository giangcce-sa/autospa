import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_MANIFEST_BYTES = 64 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function resolveBackupS3Config(env = process.env) {
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY must be configured together");
  }
  return {
    bucket: required(env.BACKUP_S3_BUCKET, "BACKUP_S3_BUCKET"),
    client: {
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      endpoint: env.BACKUP_S3_ENDPOINT || undefined,
      forcePathStyle: env.BACKUP_S3_FORCE_PATH_STYLE === "true",
      region: env.BACKUP_S3_REGION || "auto",
    },
    prefix: (env.BACKUP_S3_PREFIX || "autospa").replace(/^\/+|\/+$/g, ""),
  };
}

export function createBackupS3Client(config) {
  return new S3Client(config.client);
}

async function digestStream(body, outputPath) {
  if (!body || typeof body[Symbol.asyncIterator] !== "function") throw new Error("S3 object body is not streamable");
  const hash = createHash("sha256");
  let bytes = 0;
  const source = async function* () {
    for await (const chunk of body) {
      const buffer = Buffer.from(chunk);
      hash.update(buffer);
      bytes += buffer.length;
      yield buffer;
    }
  }();
  if (outputPath) await pipeline(source, createWriteStream(outputPath, { flags: "wx", mode: 0o600 }));
  else for await (const _chunk of source) void _chunk;
  return { bytes, sha256: hash.digest("hex") };
}

export async function uploadVerifiedBackup({
  artifactPath,
  client,
  config,
  manifest,
  manifestKey,
  objectKey,
}) {
  const artifact = await stat(artifactPath);
  await client.send(new PutObjectCommand({
    Body: createReadStream(artifactPath),
    Bucket: config.bucket,
    ContentLength: artifact.size,
    ContentType: "application/octet-stream",
    Key: objectKey,
    Metadata: {
      "autospa-backup-format": String(manifest.formatVersion),
      "autospa-key-id": String(manifest.keyId || "unspecified"),
    },
  }));

  const downloaded = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  const verified = await digestStream(downloaded.Body);
  if (verified.bytes !== manifest.ciphertextBytes || verified.sha256 !== manifest.ciphertextSha256) {
    throw new Error("Uploaded backup verification failed");
  }

  const manifestBody = `${JSON.stringify({ ...manifest, manifestKey, objectKey }, null, 2)}\n`;
  await client.send(new PutObjectCommand({
    Body: manifestBody,
    Bucket: config.bucket,
    ContentLength: Buffer.byteLength(manifestBody),
    ContentType: "application/json",
    Key: manifestKey,
  }));
  return { manifestKey, objectKey, verified };
}

export async function downloadBackupObject({ client, config, objectKey, outputPath }) {
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  return digestStream(object.Body, outputPath);
}

export function validateBackupManifest(value, expected = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid backup manifest");
  if (value.formatVersion !== 1 || value.cipher !== "aes-256-gcm") throw new Error("Unsupported backup manifest format");
  if (!value.database || typeof value.database !== "string") throw new Error("Backup manifest database is required");
  if (!value.keyId || typeof value.keyId !== "string") throw new Error("Backup manifest keyId is required");
  if (!Number.isSafeInteger(value.ciphertextBytes) || value.ciphertextBytes <= 0) throw new Error("Invalid backup manifest size");
  if (!SHA256_PATTERN.test(value.ciphertextSha256)) throw new Error("Invalid backup manifest checksum");
  if (!value.objectKey || typeof value.objectKey !== "string") throw new Error("Backup manifest objectKey is required");
  if (!value.manifestKey || typeof value.manifestKey !== "string") throw new Error("Backup manifest manifestKey is required");
  if (expected.manifestKey && value.manifestKey !== expected.manifestKey) throw new Error("Backup manifest key mismatch");
  if (expected.objectKey && value.objectKey !== expected.objectKey) throw new Error("Backup object key mismatch");
  if (expected.keyId && value.keyId !== expected.keyId) throw new Error("Backup encryption key ID mismatch");
  return value;
}

export async function downloadBackupManifest({ client, config, manifestKey }) {
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: manifestKey }));
  if (Number(object.ContentLength) > MAX_MANIFEST_BYTES) throw new Error("Backup manifest is too large");
  if (!object.Body || typeof object.Body[Symbol.asyncIterator] !== "function") {
    throw new Error("S3 manifest body is not streamable");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of object.Body) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_MANIFEST_BYTES) throw new Error("Backup manifest is too large");
    chunks.push(buffer);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid backup manifest JSON");
  }
  return validateBackupManifest(value, { manifestKey });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = resolveBackupS3Config();
  const client = createBackupS3Client(config);
  if (command === "upload" && args.length === 4) {
    const [artifactPath, objectKey, manifestPath, manifestKey] = args;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    process.stdout.write(`${JSON.stringify(await uploadVerifiedBackup({ artifactPath, client, config, manifest, manifestKey, objectKey }))}\n`);
    return;
  }
  if (command === "download" && args.length === 2) {
    const [objectKey, outputPath] = args;
    process.stdout.write(`${JSON.stringify(await downloadBackupObject({ client, config, objectKey, outputPath }))}\n`);
    return;
  }
  if (command === "manifest" && args.length === 1) {
    process.stdout.write(`${JSON.stringify(await downloadBackupManifest({ client, config, manifestKey: args[0] }))}\n`);
    return;
  }
  throw new Error("Usage: backup-s3.mjs <upload artifact object-key manifest manifest-key|download object-key output|manifest manifest-key>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
