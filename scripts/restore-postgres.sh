#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:?Usage: scripts/restore-postgres.sh backup.dump}"
connection_url="${DIRECT_URL:-${DATABASE_URL:-}}"
: "${connection_url:?DIRECT_URL or DATABASE_URL is required}"
pg_restore_bin="${PG_RESTORE_BIN:-pg_restore}"
psql_bin="${PSQL_BIN:-psql}"
test -f "${backup_file}"

database_name="$(node -e 'const value = process.argv[1]; console.log(decodeURIComponent(new URL(value).pathname.slice(1)))' "${connection_url}")"
if [[ ! "${database_name}" =~ (_test|_e2e)$ ]]; then
  printf 'Refusing restore into non-test database: %s\n' "${database_name}" >&2
  exit 1
fi

existing_tables="$("${psql_bin}" "${connection_url}" -Atqc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'")"
if [[ "${existing_tables}" != "0" ]]; then
  printf 'Refusing restore into non-empty database %s (%s public tables)\n' "${database_name}" "${existing_tables}" >&2
  exit 1
fi

"${pg_restore_bin}" \
  --dbname="${connection_url}" \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "${backup_file}"

"${psql_bin}" "${connection_url}" -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null
printf 'Restore verified: %s -> %s\n' "${backup_file}" "${database_name}"
