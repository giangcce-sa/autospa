import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("every scheduled task uses a dedicated authenticated cron route", async () => {
  const config = JSON.parse(await source("vercel.json"));
  assert.ok(config.crons.length > 0);

  for (const cron of config.crons) {
    assert.match(cron.path, /^\/api\/cron\/[a-z0-9-]+$/);
    const routePath = `src/app${cron.path}/route.ts`;
    await access(new URL(`../${routePath}`, import.meta.url));
    const route = await source(routePath);
    assert.match(route, /verifyCronAuth\(req\)/);
  }
});

test("VPS cron schedule stays in parity with Vercel", async () => {
  const config = JSON.parse(await source("vercel.json"));
  const crontab = await source("deploy/autospa.cron.example");
  const entries = crontab
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && !line.includes("="))
    .map((line) => {
      const match = line.match(/^(\S+\s+\S+\s+\S+\s+\S+\s+\S+).*run-autospa-cron\.sh (\/api\/cron\/[a-z0-9-]+)/);
      assert.ok(match, `Invalid cron entry: ${line}`);
      return { schedule: match[1], path: match[2] };
    });
  assert.deepEqual(entries, config.crons);
});

test("CRM scheduled refresh delegates to the shared CLV service and records terminal state", async () => {
  const route = await source("src/app/api/cron/crm-insights/route.ts");
  const userRoute = await source("src/app/api/crm/insights/route.ts");

  assert.match(route, /runLoggedJob\(/);
  assert.match(route, /updateCachedCLV/);
  assert.match(userRoute, /await requireUser\(\{ owner: true \}\)/);
  assert.equal(userRoute.includes("verifyCronAuth"), false);
});
