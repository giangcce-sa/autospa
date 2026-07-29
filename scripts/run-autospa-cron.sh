#!/usr/bin/env sh
set -eu

endpoint="${1:?Usage: run-autospa-cron.sh /api/cron/ads-optimize}"
: "${AUTOSPA_BASE_URL:?AUTOSPA_BASE_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

job="${endpoint##*/}"
case "${job}" in
  *[!a-z0-9-]*|'') printf 'Invalid cron endpoint\n' >&2; exit 1 ;;
esac
[ "${endpoint}" = "/api/cron/${job}" ] || { printf 'Invalid cron endpoint\n' >&2; exit 1; }
notify() {
  base_url="$1"
  [ -n "${base_url}" ] || return 0
  curl --fail --silent --show-error --max-time 15 "${base_url%/}/${job}" >/dev/null || true
}

finish() {
  status=$?
  trap - 0
  if [ "${status}" -eq 0 ]; then
    notify "${CRON_HEARTBEAT_SUCCESS_BASE_URL:-}"
  else
    notify "${CRON_HEARTBEAT_FAILURE_BASE_URL:-}"
  fi
  exit "${status}"
}
trap finish 0

curl --fail --silent --show-error \
  --max-time 900 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${AUTOSPA_BASE_URL%/}${endpoint}"
