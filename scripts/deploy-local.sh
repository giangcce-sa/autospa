#!/usr/bin/env bash
set -euo pipefail

release="${1:?Usage: scripts/deploy-local.sh <release-id>}"
[[ "${release}" =~ ^[A-Za-z0-9._-]+$ ]] || { printf 'Invalid release id\n' >&2; exit 1; }
: "${DIRECT_URL:?DIRECT_URL is required for backup and migrations}"
: "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}"

backup_dir="${BACKUP_DIR:-.data/backups}"
mkdir -p "${backup_dir}"
backup_file="${backup_dir}/autospa-predeploy-${release}-$(date -u +%Y%m%dT%H%M%SZ).dump"
ALLOW_PRODUCTION_DATABASE_BACKUP="backup:$(node -e 'console.log(decodeURIComponent(new URL(process.argv[1]).pathname.slice(1)))' "${DIRECT_URL}")" \
  scripts/backup-postgres.sh "${backup_file}"

export APP_RELEASE="${release}"
export AUTOSPA_IMAGE="autospa:${release}"
export AUTOSPA_MIGRATOR_IMAGE="autospa-migrator:${release}"
docker compose build migrate autospa
docker compose run --rm migrate
docker compose up -d --no-deps autospa

ready_url="${NEXT_PUBLIC_APP_URL%/}/api/ready"
for _attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 "${ready_url}" >/dev/null; then
    printf 'Release %s ready; backup: %s\n' "${release}" "${backup_file}"
    exit 0
  fi
  sleep 2
done

printf 'Release %s failed readiness; application image can be rolled back, database must use forward-fix or authorized restore\n' "${release}" >&2
exit 1
