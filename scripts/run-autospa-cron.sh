#!/usr/bin/env sh
set -eu

endpoint="${1:?Usage: run-autospa-cron.sh /api/cron/ads-optimize}"
: "${AUTOSPA_BASE_URL:?AUTOSPA_BASE_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

curl --fail --silent --show-error \
  --max-time 900 \
  --retry 2 \
  --retry-all-errors \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${AUTOSPA_BASE_URL%/}${endpoint}"
