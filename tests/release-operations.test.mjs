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
  assert.match(backup, /DIRECT_URL:\?DIRECT_URL is required/);
  assert.match(restore, /DIRECT_URL:\?DIRECT_URL is required/);
  assert.equal(backup.includes("DATABASE_URL"), false);
  assert.equal(restore.includes("DATABASE_URL"), false);
  assert.match(backup, /pg_dump/);
  assert.match(backup, /pg_restore_bin/);
  assert.match(backup, /--list/);
  assert.match(restore, /\(_test\|_e2e\)/);
  assert.match(restore, /Refusing restore into non-empty database/);
  assert.match(restore, /pg_restore/);
  assert.match(restore, /--single-transaction/);
});

test("off-host backup publishes a manifest only after read-back verification", async () => {
  const [runner, restoreDrill, storage, cron] = await Promise.all([
    source("scripts/run-postgres-backup.sh"),
    source("scripts/run-postgres-restore-drill.sh"),
    source("scripts/lib/backup-s3.mjs"),
    source("deploy/autospa-backup.cron.example"),
  ]);

  assert.match(runner, /umask 077/);
  assert.match(runner, /BACKUP_ENCRYPTION_KEY/);
  assert.match(runner, /BACKUP_S3_BUCKET/);
  assert.ok(runner.indexOf('rm -f "${plaintext}"') < runner.indexOf('backup-s3.mjs" upload'));
  assert.ok(storage.indexOf("GetObjectCommand") < storage.lastIndexOf("PutObjectCommand"));
  assert.match(storage, /Uploaded backup verification failed/);
  assert.equal(storage.includes("MEDIA_S3_"), false);
  assert.match(restoreDrill, /\(_test\|_e2e\)/);
  assert.match(restoreDrill, /_prisma_migrations/);
  assert.match(restoreDrill, /validateBackupManifest/);
  assert.match(restoreDrill, /Backup envelope does not match manifest/);
  assert.match(cron, /flock -n/);
});

test("Gateway deployment preserves data and rolls back only the application image", async () => {
  const [deploy, compose, dockerfile, seed] = await Promise.all([
    source("internal-ai-gateway/scripts/deploy-vps.sh"),
    source("internal-ai-gateway/docker-compose.prod.yml"),
    source("internal-ai-gateway/Dockerfile"),
    source("internal-ai-gateway/src/db/seed.ts"),
  ]);

  assert.match(deploy, /Refusing to reuse immutable release image/);
  assert.match(deploy, /SSH_IDENTITY_FILE/);
  assert.match(deploy, /run --rm --no-deps -T/);
  assert.match(deploy, /<\/dev\/null/);
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
  assert.match(cronRunner, /CRON_HEARTBEAT_SUCCESS_BASE_URL/);
  assert.match(cronRunner, /CRON_HEARTBEAT_FAILURE_BASE_URL/);
  assert.match(cronRunner, /Invalid cron endpoint/);
  assert.ok(deploy.indexOf("backup-postgres.sh") < deploy.indexOf("docker compose run --rm migrate"));
  assert.ok(deploy.indexOf("docker compose run --rm migrate") < deploy.indexOf("docker compose up -d --no-deps autospa"));
  assert.match(deploy, /\/api\/ready/);
  assert.match(rollback, /--no-build autospa/);
  assert.match(rollback, /for _attempt in \{1\.\.30\}/);
  assert.match(rollback, /APP_RELEASE/);
  assert.equal(rollback.includes("migrate"), false);
});

test("AutoSpa SSH deployment uses a pinned host profile and preserves server data", async () => {
  const [deploy, sshConfig] = await Promise.all([
    source("scripts/deploy-vps.sh"),
    source("deploy/ssh_config"),
  ]);

  assert.match(sshConfig, /Host autospa-vps/);
  assert.match(sshConfig, /HostName 34\.87\.65\.200/);
  assert.match(sshConfig, /IdentityFile ~\/\.ssh\/qq_vps_new/);
  assert.match(sshConfig, /StrictHostKeyChecking yes/);
  assert.match(deploy, /SSH_IDENTITY_FILE/);
  assert.match(deploy, /--exclude \.env/);
  assert.match(deploy, /--exclude \.data/);
  assert.match(deploy, /--exclude public\/uploads/);
  assert.match(deploy, /scripts\/deploy-local\.sh/);
  assert.ok(deploy.indexOf("rsync -az") < deploy.indexOf('scripts/deploy-local.sh "${release}"'));
});
