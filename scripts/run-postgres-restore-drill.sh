#!/usr/bin/env bash
set -euo pipefail
umask 077

manifest_key="${1:?Usage: scripts/run-postgres-restore-drill.sh manifest-key}"
: "${DIRECT_URL:?DIRECT_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_KEY_ID:?BACKUP_KEY_ID is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work_root="${BACKUP_WORK_DIR:-${script_dir}/../.data/backups}"
mkdir -p "${work_root}"
work_dir="$(mktemp -d "${work_root%/}/restore.XXXXXX")"
encrypted="${work_dir}/backup.dump.enc"
plaintext="${work_dir}/backup.dump"
manifest_file="${work_dir}/manifest.json"

cleanup() {
  rm -f "${encrypted}" "${plaintext}" "${manifest_file}"
  rmdir "${work_dir}" 2>/dev/null || true
}
trap cleanup EXIT

database_name="$(node -e 'const value = process.argv[1]; console.log(decodeURIComponent(new URL(value).pathname.slice(1)))' "${DIRECT_URL}")"
if [[ ! "${database_name}" =~ (_test|_e2e)$ ]]; then
  printf 'Refusing restore drill into non-test database: %s\n' "${database_name}" >&2
  exit 1
fi

node "${script_dir}/lib/backup-s3.mjs" manifest "${manifest_key}" > "${manifest_file}"
object_key="$(node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  import { pathToFileURL } from "node:url";
  const [modulePath, manifestPath, manifestKey, keyId] = process.argv.slice(1);
  const { validateBackupManifest } = await import(pathToFileURL(modulePath));
  const manifest = validateBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")), { manifestKey, keyId });
  process.stdout.write(manifest.objectKey);
' "${script_dir}/lib/backup-s3.mjs" "${manifest_file}" "${manifest_key}" "${BACKUP_KEY_ID}")"
download_result="$(node "${script_dir}/lib/backup-s3.mjs" download "${object_key}" "${encrypted}")"
node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  import { pathToFileURL } from "node:url";
  const [modulePath, manifestPath, manifestKey, objectKey, keyId, resultJson] = process.argv.slice(1);
  const { validateBackupManifest } = await import(pathToFileURL(modulePath));
  const manifest = validateBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")), { manifestKey, objectKey, keyId });
  const result = JSON.parse(resultJson);
  if (result.sha256 !== manifest.ciphertextSha256 || result.bytes !== manifest.ciphertextBytes) throw new Error("Downloaded backup does not match manifest");
' "${script_dir}/lib/backup-s3.mjs" "${manifest_file}" "${manifest_key}" "${object_key}" "${BACKUP_KEY_ID}" "${download_result}"
decrypt_result="$(node "${script_dir}/lib/backup-crypto.mjs" decrypt "${encrypted}" "${plaintext}")"
node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  const [manifestPath, headerJson] = process.argv.slice(1);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const header = JSON.parse(headerJson);
  for (const field of ["cipher", "database", "formatVersion", "keyId", "plaintextBytes", "plaintextSha256"]) {
    if (header[field] !== manifest[field]) throw new Error(`Backup envelope does not match manifest: ${field}`);
  }
' "${manifest_file}" "${decrypt_result}"
"${script_dir}/restore-postgres.sh" "${plaintext}"
psql_bin="${PSQL_BIN:-psql}"
"${psql_bin}" "${DIRECT_URL}" -v ON_ERROR_STOP=1 -Atqc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AND to_regclass('public.\"User\"') IS NOT NULL AND to_regclass('public.\"Settings\"') IS NOT NULL" | grep -qx t
printf 'Restore drill verified: %s -> %s\n' "${object_key}" "${database_name}"
