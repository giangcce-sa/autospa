#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DIRECT_URL:?DIRECT_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_KEY_ID:?BACKUP_KEY_ID is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work_root="${BACKUP_WORK_DIR:-${script_dir}/../.data/backups}"
mkdir -p "${work_root}"
work_dir="$(mktemp -d "${work_root%/}/run.XXXXXX")"
plaintext="${work_dir}/backup.dump"
encrypted="${work_dir}/backup.dump.enc"
manifest_file="${work_dir}/manifest.json"

cleanup() {
  rm -f "${plaintext}" "${encrypted}" "${manifest_file}"
  rmdir "${work_dir}" 2>/dev/null || true
}
trap cleanup EXIT

database_name="$(node -e 'const value = process.argv[1]; console.log(decodeURIComponent(new URL(value).pathname.slice(1)))' "${DIRECT_URL}")"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
date_path="$(date -u +%Y/%m/%d)"
prefix="${BACKUP_S3_PREFIX:-autospa}"
prefix="${prefix#/}"
prefix="${prefix%/}"
base_key="${prefix}/${date_path}/autospa-${database_name}-${timestamp}"
object_key="${base_key}.dump.enc"
manifest_key="${base_key}.manifest.json"

"${script_dir}/backup-postgres.sh" "${plaintext}"
BACKUP_DATABASE_NAME="${database_name}" node "${script_dir}/lib/backup-crypto.mjs" encrypt "${plaintext}" "${encrypted}" > "${manifest_file}"
rm -f "${plaintext}"
node "${script_dir}/lib/backup-s3.mjs" upload "${encrypted}" "${object_key}" "${manifest_file}" "${manifest_key}" >/dev/null
printf 'Backup uploaded and verified: %s (%s)\n' "${object_key}" "${manifest_key}"
