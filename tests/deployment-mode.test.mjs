import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeploymentMode } from "../src/lib/deployment-mode.ts";

test("deployment mode honors explicit persistent and stateless values", () => {
  assert.deepEqual(resolveDeploymentMode({ DEPLOYMENT_MODE: "persistent" }), {
    mode: "persistent", source: "explicit", valid: true,
  });
  assert.deepEqual(resolveDeploymentMode({ DEPLOYMENT_MODE: "stateless", VERCEL: "1" }), {
    mode: "stateless", source: "explicit", valid: true,
  });
});

test("deployment mode detects Vercel and fails closed for invalid values", () => {
  assert.deepEqual(resolveDeploymentMode({ VERCEL_ENV: "production" }), {
    mode: "stateless", source: "vercel_fallback", valid: true,
  });
  assert.deepEqual(resolveDeploymentMode({ DEPLOYMENT_MODE: "serverless" }), {
    mode: "stateless", source: "invalid", valid: false,
  });
  assert.deepEqual(resolveDeploymentMode({}), {
    mode: "persistent", source: "compatibility_fallback", valid: true,
  });
});
