import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductionEnvironmentPolicy } from "../src/lib/production-environment-policy.ts";

const productionEnv = {
  DEPLOYMENT_ENV: "production",
  AUTH_SECRET: "a-secure-production-auth-secret-123456",
  CRON_SECRET: "a-secure-production-cron-secret-123456",
  AUTH_URL: "https://autospa.example.com",
  NEXT_PUBLIC_APP_URL: "https://autospa.example.com",
  DEPLOYMENT_MODE: "persistent",
  APP_RELEASE: "sha-123",
  ADS_EXECUTION_MODE: "read_only",
  ADS_EMERGENCY_STOP: "true",
  VIDEO_EXECUTION_MODE: "mock",
  VIDEO_EMERGENCY_STOP: "true",
};

test("production environment requires explicit secure release configuration", () => {
  assert.deepEqual(resolveProductionEnvironmentPolicy(productionEnv), { valid: true, blockers: [] });
});

test("production environment rejects weak secrets, mismatched origins and implicit safety modes", () => {
  const result = resolveProductionEnvironmentPolicy({
    ...productionEnv,
    AUTH_SECRET: "change-me",
    CRON_SECRET: "short",
    NEXT_PUBLIC_APP_URL: "https://other.example.com",
    DEPLOYMENT_MODE: "",
    APP_RELEASE: "",
    ADS_EXECUTION_MODE: "",
    ADS_EMERGENCY_STOP: "yes",
    VIDEO_EXECUTION_MODE: "enabled",
    VIDEO_EMERGENCY_STOP: "",
  });

  assert.equal(result.valid, false);
  assert.equal(result.blockers.length, 9);
  assert.match(result.blockers.join("\n"), /AUTH_SECRET/);
  assert.match(result.blockers.join("\n"), /cùng origin/);
  assert.match(result.blockers.join("\n"), /APP_RELEASE/);
});

test("non-production environments retain compatibility behavior", () => {
  assert.deepEqual(resolveProductionEnvironmentPolicy({ DEPLOYMENT_ENV: "staging" }), { valid: true, blockers: [] });
  assert.deepEqual(resolveProductionEnvironmentPolicy({}), { valid: true, blockers: [] });
});
