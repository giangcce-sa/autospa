import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legacy Settings validates provider URLs after merging parsed fields", async () => {
  const route = await source("src/app/api/settings/route.ts");
  const mergeIndex = route.indexOf("Object.assign(updateData, providerPatch, imagePatch)");
  const claudeSafeIndex = route.indexOf("updateData.claudeBaseUrl = safeUrl");
  const openAiSafeIndex = route.indexOf("updateData.openaiBaseUrl = safeUrl");

  assert.ok(mergeIndex >= 0);
  assert.ok(claudeSafeIndex > mergeIndex);
  assert.ok(openAiSafeIndex > mergeIndex);
  assert.equal(route.indexOf("Object.assign(updateData, providerPatch, imagePatch)", mergeIndex + 1), -1);
});
