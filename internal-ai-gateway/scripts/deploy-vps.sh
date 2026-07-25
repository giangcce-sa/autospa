#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  printf 'Usage: scripts/deploy-vps.sh <ssh-target> <remote-dir> <release>\n' >&2
  printf 'Example: scripts/deploy-vps.sh root@203.0.113.10 /opt/internal-ai-gateway 2026.07.25-1\n' >&2
  exit 1
fi

ssh_target="$1"
remote_dir="$2"
release="$3"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"

if [[ ! "${remote_dir}" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  printf 'Invalid remote directory: %s\n' "${remote_dir}" >&2
  exit 1
fi

if [[ ! "${release}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]]; then
  printf 'Invalid release identifier: %s\n' "${release}" >&2
  exit 1
fi

ssh_options=()
rsync_ssh=()
if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
  ssh_options=(-i "${SSH_IDENTITY_FILE}")
  rsync_ssh=(-e "ssh -i \"${SSH_IDENTITY_FILE}\"")
fi

rsync -az --delete "${rsync_ssh[@]}" \
  --exclude node_modules \
  --exclude dist \
  --exclude data \
  --exclude audit-logs \
  --exclude kiro-workspaces \
  --exclude backups \
  --exclude '.backup-*' \
  --exclude .env \
  --exclude .git \
  "${project_dir}/" "${ssh_target}:${remote_dir}/"

ssh "${ssh_options[@]}" "${ssh_target}" bash -s -- "${remote_dir}" "${release}" <<'REMOTE'
set -euo pipefail

remote_dir="$1"
release="$2"
release_image="internal-ai-gateway:${release}"
cd "${remote_dir}"
compose=(docker compose -f docker-compose.prod.yml)

test -f .env || {
  printf 'Missing %s/.env. Copy .env.vps.example to .env and fill secrets.\n' "${remote_dir}" >&2
  exit 1
}

if docker image inspect "${release_image}" >/dev/null 2>&1; then
  printf 'Refusing to reuse immutable release image: %s\n' "${release_image}" >&2
  exit 1
fi

previous_container_id="$("${compose[@]}" ps -q gateway)"
previous_image=""
if [[ -n "${previous_container_id}" ]]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "${previous_container_id}")"
fi

GATEWAY_IMAGE="${release_image}" "${compose[@]}" build gateway
BACKUP_RELEASE="${release}" GATEWAY_IMAGE="${release_image}" "${compose[@]}" run --rm --no-deps \
  -e BACKUP_RELEASE gateway node --input-type=module -e '
    import { existsSync, mkdirSync } from "node:fs";
    import { dirname, resolve } from "node:path";
    import { DatabaseSync } from "node:sqlite";

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl?.startsWith("file:")) {
      throw new Error("SQLite DATABASE_URL must start with file:");
    }

    const sourcePath = resolve(databaseUrl.slice("file:".length));
    if (!existsSync(sourcePath)) {
      console.log(`No existing SQLite database to back up: ${sourcePath}`);
      process.exit(0);
    }

    const backupDir = resolve(dirname(sourcePath), "backups");
    const backupPath = resolve(backupDir, `predeploy-${process.env.BACKUP_RELEASE}.db`);
    mkdirSync(backupDir, { recursive: true });

    const source = new DatabaseSync(sourcePath);
    source.prepare("VACUUM INTO ?").run(backupPath);
    source.close();

    const backup = new DatabaseSync(backupPath, { readOnly: true });
    const integrity = backup.prepare("PRAGMA integrity_check").get();
    backup.close();
    if (integrity?.integrity_check !== "ok") {
      throw new Error(`SQLite backup integrity check failed: ${JSON.stringify(integrity)}`);
    }
    console.log(`Verified SQLite backup: ${backupPath}`);
  '
GATEWAY_IMAGE="${release_image}" "${compose[@]}" up -d nine-router
GATEWAY_IMAGE="${release_image}" "${compose[@]}" up -d --no-deps gateway

healthy=false
for _ in $(seq 1 20); do
  current_container_id="$(GATEWAY_IMAGE="${release_image}" "${compose[@]}" ps -q gateway)"
  if [[ -n "${current_container_id}" ]]; then
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${current_container_id}")"
    if [[ "${status}" == "healthy" ]]; then
      healthy=true
      break
    fi
    if [[ "${status}" == "unhealthy" || "${status}" == "exited" || "${status}" == "dead" ]]; then
      break
    fi
  fi
  sleep 3
done

if [[ "${healthy}" != "true" ]]; then
  GATEWAY_IMAGE="${release_image}" "${compose[@]}" logs --no-color --tail=100 gateway >&2 || true
  if [[ -n "${previous_image}" ]]; then
    printf 'Gateway health failed; rolling application image back to %s. SQLite was not restored.\n' "${previous_image}" >&2
    GATEWAY_IMAGE="${previous_image}" "${compose[@]}" up -d --no-deps gateway
  else
    printf 'Gateway health failed and no previous image exists. SQLite was not restored.\n' >&2
    GATEWAY_IMAGE="${release_image}" "${compose[@]}" stop gateway || true
  fi
  exit 1
fi

GATEWAY_IMAGE="${release_image}" "${compose[@]}" up -d --no-deps caddy
GATEWAY_IMAGE="${release_image}" "${compose[@]}" ps
printf 'Deployed immutable Gateway image %s\n' "${release_image}"
REMOTE
