#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: scripts/deploy-vps.sh <ssh-target> <remote-dir>"
  echo "Example: scripts/deploy-vps.sh root@203.0.113.10 /opt/internal-ai-gateway"
  exit 1
fi

SSH_TARGET="$1"
REMOTE_DIR="$2"

rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude data \
  --exclude audit-logs \
  --exclude kiro-workspaces \
  --exclude .env \
  --exclude .git \
  ./ "${SSH_TARGET}:${REMOTE_DIR}/"

ssh "${SSH_TARGET}" "cd '${REMOTE_DIR}' && \
  test -f .env || (echo 'Missing ${REMOTE_DIR}/.env. Copy .env.vps.example to .env and fill secrets.' && exit 1) && \
  docker compose -f docker-compose.prod.yml up -d --build && \
  docker compose -f docker-compose.prod.yml ps"
