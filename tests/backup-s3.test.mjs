import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { resolveBackupS3Config, uploadVerifiedBackup, validateBackupManifest } from "../scripts/lib/backup-s3.mjs";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("backup S3 config uses isolated credentials and rejects partial credentials", () => {
  const config = resolveBackupS3Config({
    BACKUP_S3_ACCESS_KEY_ID: "backup-access",
    BACKUP_S3_BUCKET: "autospa-backups",
    BACKUP_S3_ENDPOINT: "https://storage.example.test",
    BACKUP_S3_PREFIX: "/daily/",
    BACKUP_S3_SECRET_ACCESS_KEY: "backup-secret",
  });

  assert.equal(config.bucket, "autospa-backups");
  assert.equal(config.prefix, "daily");
  assert.deepEqual(config.client.credentials, {
    accessKeyId: "backup-access",
    secretAccessKey: "backup-secret",
  });
  assert.equal(JSON.stringify(config).includes("MEDIA_S3"), false);
  assert.throws(
    () => resolveBackupS3Config({ BACKUP_S3_ACCESS_KEY_ID: "partial", BACKUP_S3_BUCKET: "bucket" }),
    /configured together/,
  );
});

test("backup manifest uploads only after encrypted object read-back verification", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "autospa-backup-s3-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifactPath = join(directory, "backup.enc");
  const artifact = Buffer.from("encrypted-backup");
  await writeFile(artifactPath, artifact);
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command.constructor.name);
      if (command.constructor.name === "GetObjectCommand") return { Body: Readable.from([artifact]) };
      return {};
    },
  };
  const manifest = {
    ciphertextBytes: artifact.length,
    ciphertextSha256: digest(artifact),
    formatVersion: 1,
    keyId: "key-1",
  };

  await uploadVerifiedBackup({
    artifactPath,
    client,
    config: { bucket: "bucket" },
    manifest,
    manifestKey: "backups/manifest.json",
    objectKey: "backups/backup.enc",
  });

  assert.deepEqual(commands, ["PutObjectCommand", "GetObjectCommand", "PutObjectCommand"]);
});

test("backup manifest validation binds storage keys and encryption identity", () => {
  const manifest = {
    cipher: "aes-256-gcm",
    ciphertextBytes: 100,
    ciphertextSha256: "a".repeat(64),
    database: "autospa",
    formatVersion: 1,
    keyId: "key-1",
    manifestKey: "database/manifest.json",
    objectKey: "database/backup.enc",
  };

  assert.equal(validateBackupManifest(manifest, {
    keyId: "key-1",
    manifestKey: "database/manifest.json",
    objectKey: "database/backup.enc",
  }), manifest);
  assert.throws(() => validateBackupManifest(manifest, { objectKey: "other.enc" }), /object key mismatch/);
  assert.throws(() => validateBackupManifest({ ...manifest, ciphertextSha256: "invalid" }), /checksum/);
});

test("backup checksum mismatch prevents manifest publication", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "autospa-backup-s3-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifactPath = join(directory, "backup.enc");
  await writeFile(artifactPath, "encrypted-backup");
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command.constructor.name);
      if (command.constructor.name === "GetObjectCommand") return { Body: Readable.from(["corrupt"]) };
      return {};
    },
  };

  await assert.rejects(uploadVerifiedBackup({
    artifactPath,
    client,
    config: { bucket: "bucket" },
    manifest: { ciphertextBytes: 16, ciphertextSha256: "wrong", formatVersion: 1 },
    manifestKey: "manifest.json",
    objectKey: "backup.enc",
  }), /verification failed/);
  assert.deepEqual(commands, ["PutObjectCommand", "GetObjectCommand"]);
});
