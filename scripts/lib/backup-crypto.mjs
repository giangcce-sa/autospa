import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

const MAGIC = Buffer.from("ASPA_BK1");
const TAG_BYTES = 16;
const MAX_HEADER_BYTES = 64 * 1024;

function encryptionKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!value) throw new Error("BACKUP_ENCRYPTION_KEY is required");
  const encoding = /^[0-9a-f]{64}$/i.test(value) ? "hex" : "base64";
  const key = Buffer.from(value, encoding);
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

async function fileDigest(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

function hashTransform(hash) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
}

function encodeHeader(metadata) {
  const json = Buffer.from(JSON.stringify(metadata));
  if (json.length > MAX_HEADER_BYTES) throw new Error("Backup header is too large");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(json.length);
  return Buffer.concat([MAGIC, length, json]);
}

async function readEnvelope(path) {
  const info = await stat(path);
  if (info.size < MAGIC.length + 4 + TAG_BYTES) throw new Error("Backup envelope is truncated");

  const handle = await open(path, "r");
  try {
    const prefix = Buffer.alloc(MAGIC.length + 4);
    await handle.read(prefix, 0, prefix.length, 0);
    if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Unsupported backup envelope");

    const headerLength = prefix.readUInt32BE(MAGIC.length);
    if (headerLength < 2 || headerLength > MAX_HEADER_BYTES) throw new Error("Invalid backup header length");
    const ciphertextStart = prefix.length + headerLength;
    if (info.size < ciphertextStart + TAG_BYTES) throw new Error("Backup envelope is truncated");

    const headerJson = Buffer.alloc(headerLength);
    await handle.read(headerJson, 0, headerLength, prefix.length);
    let header;
    try {
      header = JSON.parse(headerJson.toString("utf8"));
    } catch {
      throw new Error("Invalid backup header");
    }

    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, info.size - TAG_BYTES);
    return {
      aad: Buffer.concat([prefix, headerJson]),
      ciphertextEnd: info.size - TAG_BYTES - 1,
      ciphertextStart,
      header,
      tag,
    };
  } finally {
    await handle.close();
  }
}

export async function encryptBackup(inputPath, outputPath, options = {}) {
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("Input and output paths must differ");
  const key = encryptionKey(options.key);
  const plaintext = await fileDigest(inputPath);
  const iv = randomBytes(12);
  const header = {
    cipher: "aes-256-gcm",
    createdAt: options.createdAt ?? new Date().toISOString(),
    database: options.database ?? null,
    formatVersion: 1,
    keyId: options.keyId ?? null,
    plaintextBytes: plaintext.bytes,
    plaintextSha256: plaintext.sha256,
  };
  const aad = encodeHeader(header);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  try {
    const output = createWriteStream(outputPath, { flags: "wx", mode: 0o600 });
    output.write(aad);
    output.write(iv);
    const fullAad = Buffer.concat([aad, iv]);
    cipher.setAAD(fullAad);
    await pipeline(createReadStream(inputPath), cipher, output, { end: false });
    output.end(cipher.getAuthTag());
    await new Promise((resolvePromise, reject) => {
      output.once("finish", resolvePromise);
      output.once("error", reject);
    });
    const encrypted = await fileDigest(outputPath);
    return { ...header, ciphertextBytes: encrypted.bytes, ciphertextSha256: encrypted.sha256, iv: iv.toString("base64") };
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
}

export async function decryptBackup(inputPath, outputPath, options = {}) {
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("Input and output paths must differ");
  const key = encryptionKey(options.key);
  const envelope = await readEnvelope(inputPath);
  const ivStart = envelope.ciphertextStart;
  const handle = await open(inputPath, "r");
  const iv = Buffer.alloc(12);
  try {
    await handle.read(iv, 0, iv.length, ivStart);
  } finally {
    await handle.close();
  }
  const ciphertextStart = ivStart + iv.length;
  if (ciphertextStart > envelope.ciphertextEnd + 1) throw new Error("Backup envelope has no ciphertext");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.concat([envelope.aad, iv]));
  decipher.setAuthTag(envelope.tag);
  const plaintextHash = createHash("sha256");

  try {
    await pipeline(
      createReadStream(inputPath, { start: ciphertextStart, end: envelope.ciphertextEnd }),
      decipher,
      hashTransform(plaintextHash),
      createWriteStream(outputPath, { flags: "wx", mode: 0o600 }),
    );
    const info = await stat(outputPath);
    const digest = plaintextHash.digest("hex");
    if (digest !== envelope.header.plaintextSha256 || info.size !== envelope.header.plaintextBytes) {
      throw new Error("Backup plaintext checksum mismatch");
    }
    return envelope.header;
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
}

export async function inspectBackup(path) {
  const envelope = await readEnvelope(path);
  const digest = await fileDigest(path);
  return { ...envelope.header, ciphertextBytes: digest.bytes, ciphertextSha256: digest.sha256 };
}

async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  if (command === "encrypt" && inputPath && outputPath) {
    const result = await encryptBackup(inputPath, outputPath, {
      database: process.env.BACKUP_DATABASE_NAME,
      keyId: process.env.BACKUP_KEY_ID,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "decrypt" && inputPath && outputPath) {
    const result = await decryptBackup(inputPath, outputPath);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "inspect" && inputPath) {
    process.stdout.write(`${JSON.stringify(await inspectBackup(inputPath))}\n`);
    return;
  }
  throw new Error("Usage: backup-crypto.mjs <encrypt|decrypt|inspect> <input> [output]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
