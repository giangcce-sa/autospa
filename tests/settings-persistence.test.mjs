import assert from "node:assert/strict";
import test from "node:test";
import { settingsAuditInput, writeSettingsPatch } from "../src/lib/settings/persistence-policy.ts";

test("settings audit reports changed fields without exposing secret field names or values", () => {
  const input = settingsAuditInput([
    "webhookMode",
    "webhookVerifyToken",
    "spaApiKey",
    "leadHandoffMode",
  ], {
    userId: "owner-1",
    href: "/system/settings?view=automation&scope=account",
    source: "automation_settings_api",
  });

  assert.equal(input.detail, "Thay đổi 4 trường cấu hình");
  assert.deepEqual(input.metadata, {
    userId: "owner-1",
    fields: ["webhookMode", "leadHandoffMode"],
  });
  assert.equal(JSON.stringify(input).includes("webhookVerifyToken"), false);
  assert.equal(JSON.stringify(input).includes("spaApiKey"), false);
});

test("settings persistence performs one write and one best-effort audit attempt", async () => {
  const calls = [];
  const result = await writeSettingsPatch({ webhookMode: "auto", adsOptimizeMaxBudget: 2_000_000 }, {
    userId: "owner-1",
    href: "/settings",
    source: "settings_api",
  }, {
    write: async (patch) => {
      calls.push(["write", patch]);
      return { id: "1", ...patch };
    },
    audit: async (input) => {
      calls.push(["audit", input]);
      throw new Error("audit unavailable");
    },
  });

  assert.equal(calls.filter(([type]) => type === "write").length, 1);
  assert.equal(calls.filter(([type]) => type === "audit").length, 1);
  assert.deepEqual(calls.map(([type]) => type), ["write", "audit"]);
  assert.deepEqual(result, { id: "1", webhookMode: "auto", adsOptimizeMaxBudget: 2_000_000 });
});
