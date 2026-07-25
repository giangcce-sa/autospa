import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("database backup and restore scripts require explicit safe targets", async () => {
  const [backup, restore] = await Promise.all([
    source("scripts/backup-postgres.sh"),
    source("scripts/restore-postgres.sh"),
  ]);

  assert.match(backup, /ALLOW_PRODUCTION_DATABASE_BACKUP/);
  assert.match(backup, /pg_dump/);
  assert.match(backup, /pg_restore_bin/);
  assert.match(backup, /--list/);
  assert.match(restore, /\(_test\|_e2e\)/);
  assert.match(restore, /Refusing restore into non-empty database/);
  assert.match(restore, /pg_restore/);
});

test("Gateway deployment preserves data and rolls back only the application image", async () => {
  const [deploy, compose, dockerfile, seed] = await Promise.all([
    source("internal-ai-gateway/scripts/deploy-vps.sh"),
    source("internal-ai-gateway/docker-compose.prod.yml"),
    source("internal-ai-gateway/Dockerfile"),
    source("internal-ai-gateway/src/db/seed.ts"),
  ]);

  assert.match(deploy, /Refusing to reuse immutable release image/);
  assert.match(deploy, /VACUUM INTO/);
  assert.match(deploy, /PRAGMA integrity_check/);
  assert.ok(deploy.indexOf("VACUUM INTO") < deploy.indexOf("up -d --no-deps gateway"));
  assert.match(deploy, /rolling application image back/);
  assert.equal(deploy.includes("sqlite restore"), false);
  assert.match(compose, /GATEWAY_IMAGE/);
  assert.match(compose, /\/ready\/details/);
  assert.match(dockerfile, /FROM node:24-alpine/);
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /USER node/);
  assert.match(seed, /INSERT OR IGNORE INTO api_keys/);
  assert.equal(seed.includes("status = 'active'"), false);
});

test("Compose gates application startup on migrations and liveness", async () => {
  const [compose, dockerfile, smoke, cronRunner, deploy, rollback] = await Promise.all([
    source("docker-compose.yml"),
    source("Dockerfile"),
    source("scripts/smoke-test.mjs"),
    source("scripts/run-autospa-cron.sh"),
    source("scripts/deploy-local.sh"),
    source("scripts/rollback-app.sh"),
  ]);

  assert.match(compose, /migrate:/);
  assert.match(compose, /condition: service_completed_successfully/);
  assert.match(compose, /\/api\/health/);
  assert.match(dockerfile, /FROM base AS migrator/);
  assert.match(dockerfile, /"prisma", "migrate", "deploy"/);
  assert.match(smoke, /"readiness", "\/api\/ready", 200/);
  assert.equal(cronRunner.includes("--retry"), false);
  assert.ok(deploy.indexOf("backup-postgres.sh") < deploy.indexOf("docker compose run --rm migrate"));
  assert.ok(deploy.indexOf("docker compose run --rm migrate") < deploy.indexOf("docker compose up -d --no-deps autospa"));
  assert.match(deploy, /\/api\/ready/);
  assert.match(rollback, /--no-build autospa/);
  assert.equal(rollback.includes("migrate"), false);
});
