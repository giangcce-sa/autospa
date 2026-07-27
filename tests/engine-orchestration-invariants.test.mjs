import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Ads optimizer honors the server-forced dry-run and always releases its lock", async () => {
  const optimizer = await source("src/lib/ads-optimizer.ts");

  assert.match(optimizer, /const forcedDryRun = shouldForceAdsDryRun\(\)/);
  assert.match(optimizer, /const effectiveDryRun = forcedDryRun \|\| Boolean\(input\.dryRun\)/);
  assert.match(optimizer, /finally \{\s*await releaseAutomationLock\("ads-optimize", owner\)/);
});

test("Ads optimizer only mutates campaigns inside the full-automation branch", async () => {
  const optimizer = await source("src/lib/ads-optimizer.ts");

  const fullBranch = optimizer.indexOf('else if (automationLevel === "full")');
  assert.ok(fullBranch > 0, "full-automation branch exists");

  assert.equal(optimizer.match(/await setCampaignStatus\(/g)?.length, 1);
  assert.equal(optimizer.match(/await updateAdsBudget\(/g)?.length, 1);
  assert.ok(optimizer.indexOf("await setCampaignStatus(") > fullBranch);
  assert.ok(optimizer.indexOf("await updateAdsBudget(") > fullBranch);
});

test("Realtime monitor keeps its alert thresholds and 3-hour throttle", async () => {
  const monitor = await source("src/lib/realtime-monitor.ts");

  assert.match(monitor, /const THROTTLE_HOURS = 3;/);
  assert.match(monitor, /count >= 5/);   // negative comment spike per hour
  assert.match(monitor, /count >= 15/);  // hot lead pileup
  assert.match(monitor, /count >= 3/);   // ads pause anomaly per 30 minutes
  assert.match(monitor, /prevSum > 100000 && recentSum < prevSum \* 0\.5/); // revenue drop
});

test("Lead agent advances conversations under an optimistic lock", async () => {
  const agent = await source("src/lib/lead-agent.ts");

  const transaction = agent.indexOf("const advanced = await prisma.$transaction(");
  assert.ok(transaction > 0, "state advance runs in a transaction");

  const claim = agent.indexOf("version: conv.version");
  const bump = agent.indexOf("version: { increment: 1 }");
  assert.ok(claim > transaction, "claim matches the loaded version");
  assert.ok(bump > transaction, "claim increments the version");
  assert.match(agent, /if \(claimed\.count !== 1\) return false;/);
  assert.match(agent, /: \{ replyText: "", isComplete: false \};/); // lost claim → empty reply
});

test("Engine modules delegate their business rules to the extracted policy modules", async () => {
  const expectations = [
    ["src/lib/forecast.ts", "forecast-policy"],
    ["src/lib/clv-engine.ts", "clv-policy"],
    ["src/lib/customer-clv.ts", "clv-policy"],
    ["src/lib/flash-deal-engine.ts", "flash-deal-policy"],
    ["src/lib/proactive-sales.ts", "proactive-sales-policy"],
    ["src/lib/orchestrator.ts", "orchestrator-policy"],
    ["src/lib/brain.ts", "brain-policy"],
    ["src/lib/lead-nurture.ts", "lead-nurture-policy"],
  ];

  for (const [enginePath, policyName] of expectations) {
    const engine = await source(enginePath);
    assert.match(engine, new RegExp(`from "(?:@/lib|\\.)/${policyName}"`), `${enginePath} imports ${policyName}`);
  }
});

test("Policy modules stay importable from tests: no prisma, no server-only", async () => {
  const policies = [
    "src/lib/clv-policy.ts",
    "src/lib/forecast-policy.ts",
    "src/lib/flash-deal-policy.ts",
    "src/lib/proactive-sales-policy.ts",
    "src/lib/lead-nurture-policy.ts",
    "src/lib/orchestrator-policy.ts",
    "src/lib/brain-policy.ts",
  ];

  for (const path of policies) {
    const policy = await source(path);
    assert.doesNotMatch(policy, /import\s+"server-only"/, `${path} must not import server-only`);
    assert.doesNotMatch(policy, /from\s+"[^"]*\/db(?:\.ts)?"/, `${path} must not import the database client`);
    assert.doesNotMatch(policy, /from\s+"[^"]*prisma[^"]*"/, `${path} must not import prisma`);
  }
});
