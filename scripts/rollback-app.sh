#!/usr/bin/env bash
set -euo pipefail

release="${1:?Usage: scripts/rollback-app.sh <previous-release-id>}"
[[ "${release}" =~ ^[A-Za-z0-9._-]+$ ]] || { printf 'Invalid release id\n' >&2; exit 1; }
: "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}"

export APP_RELEASE="${release}"
export AUTOSPA_IMAGE="autospa:${release}"
docker compose up -d --no-deps --no-build autospa

ready_url="${NEXT_PUBLIC_APP_URL%/}/api/ready"
for _attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 "${ready_url}" >/dev/null; then
    printf 'Application rolled back to %s. Database schema was not changed.\n' "${release}"
    exit 0
  fi
  sleep 2
done

printf 'Rollback image %s failed readiness. Database schema was not changed.\n' "${release}" >&2
exit 1
