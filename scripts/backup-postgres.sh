#!/usr/bin/env bash
set -euo pipefail

: "${DIRECT_URL:?DIRECT_URL is required}"
connection_url="${DIRECT_URL}"
pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"
pg_restore_bin="${PG_RESTORE_BIN:-pg_restore}"

output="${1:-autospa-backup-$(date -u +%Y%m%dT%H%M%SZ).dump}"
database_name="$(node -e 'const value = process.argv[1]; console.log(decodeURIComponent(new URL(value).pathname.slice(1)))' "${connection_url}")"

if [[ ! "${database_name}" =~ (_test|_e2e)$ ]] && [[ "${ALLOW_PRODUCTION_DATABASE_BACKUP:-}" != "backup:${database_name}" ]]; then
  printf 'Refusing backup of database %s without ALLOW_PRODUCTION_DATABASE_BACKUP=backup:%s\n' "${database_name}" "${database_name}" >&2
  exit 1
fi

"${pg_dump_bin}" \
  --dbname="${connection_url}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="${output}"

"${pg_restore_bin}" --list "${output}" >/dev/null
printf 'Backup verified: %s\n' "${output}"
