#!/usr/bin/env bash
set -euo pipefail

release="${1:?Usage: scripts/rollback-app.sh <previous-release-id>}"
[[ "${release}" =~ ^[A-Za-z0-9._-]+$ ]] || { printf 'Invalid release id\n' >&2; exit 1; }
: "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}"

export AUTOSPA_IMAGE="autospa:${release}"
docker compose up -d --no-deps --no-build autospa
curl --fail --silent --show-error --max-time 15 "${NEXT_PUBLIC_APP_URL%/}/api/ready" >/dev/null
printf 'Application rolled back to %s. Database schema was not changed.\n' "${release}"
