import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { decryptBackup, encryptBackup, inspectBackup } from "../scripts/lib/backup-crypto.mjs";

const KEY = Buffer.alloc(32, 7).toString("base64");

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "autospa-backup-crypto-"));
  const input = join(directory, "input.dump");
  const encrypted = join(directory, "backup.dump.enc");
  const decrypted = join(directory, "restored.dump");
  const content = Buffer.concat([Buffer.from("postgres-custom-dump\n"), Buffer.alloc(128 * 1024, 42)]);
  await writeFile(input, content, { mode: 0o600 });
  return { content, decrypted, directory, encrypted, input };
}

test("backup encryption streams a versioned authenticated round trip", async (t) => {
  const files = await fixture();
  t.after(() => rm(files.directory, { recursive: true, force: true }));

  const manifest = await encryptBackup(files.input, files.encrypted, {
    createdAt: "2026-07-29T00:00:00.000Z",
    database: "autospa_test",
    key: KEY,
    keyId: "backup-key-2026-01",
  });
  const inspected = await inspectBackup(files.encrypted);
  const header = await decryptBackup(files.encrypted, files.decrypted, { key: KEY });

  assert.deepEqual(await readFile(files.decrypted), files.content);
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.cipher, "aes-256-gcm");
  assert.equal(manifest.database, "autospa_test");
  assert.equal(manifest.keyId, "backup-key-2026-01");
  assert.equal(inspected.ciphertextSha256, manifest.ciphertextSha256);
  assert.equal(header.plaintextSha256, manifest.plaintextSha256);
});

test("backup encryption rejects invalid keys and identical paths", async (t) => {
  const files = await fixture();
  t.after(() => rm(files.directory, { recursive: true, force: true }));

  await assert.rejects(encryptBackup(files.input, files.input, { key: KEY }), /must differ/);
  await assert.rejects(encryptBackup(files.input, files.encrypted, { key: "invalid" }), /exactly 32 bytes/);
});

test("backup decryption detects wrong keys and tampering without plaintext residue", async (t) => {
  const files = await fixture();
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  await encryptBackup(files.input, files.encrypted, { key: KEY });

  await assert.rejects(
    decryptBackup(files.encrypted, files.decrypted, { key: Buffer.alloc(32, 8).toString("base64") }),
  );
  await assert.rejects(readFile(files.decrypted), /ENOENT/);

  const encrypted = await readFile(files.encrypted);
  encrypted[Math.floor(encrypted.length / 2)] ^= 0xff;
  await writeFile(files.encrypted, encrypted);
  await assert.rejects(decryptBackup(files.encrypted, files.decrypted, { key: KEY }));
  await assert.rejects(readFile(files.decrypted), /ENOENT/);
});
