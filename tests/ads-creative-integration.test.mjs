import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Ads Creative route validates input and authorizes the explicit Page before generation", async () => {
  const route = await source("src/app/api/ads-creative/route.ts");
  const parseCall = route.indexOf("const input = parseAdCreativeRequest");
  const authorizeCall = route.indexOf("await requirePageAccess");
  const generateCall = route.indexOf("const spec = await generateAdCreative");
  assert.ok(parseCall < authorizeCall);
  assert.ok(authorizeCall < generateCall);
  assert.match(route, /requirePageAccess\(input\.facebookPageId, \{ owner: true \}\)/);
});

test("Ads Creative context remains Page-scoped and history uses Page-owned campaigns", async () => {
  const creative = await source("src/lib/ads-creative.ts");
  assert.match(creative, /where: \{ facebookPageId, campaignId: \{ not: null \} \}/);
  assert.match(creative, /where: \{ id: serviceId, facebookPageId \}/);
  assert.match(creative, /findUnique\(\{ where: \{ facebookPageId \} \}\)/);
  assert.match(creative, /where: \{ facebookPageId, status: "published"/);
  assert.match(creative, /campaignHistory: history\.length \? "page_owned_autospa_campaigns" : "none"/);
  assert.match(creative, /competitorMemory: "account_global"/);
});

test("Ads Creative UI sends Page scope and labels heuristic or fallback results", async () => {
  const [assistant, manager] = await Promise.all([
    source("src/components/modules/facebook-ads/AdCreativeAssistant.tsx"),
    source("src/components/modules/facebook-ads/FacebookAdsManager.tsx"),
  ]);
  assert.match(manager, /AdCreativeAssistant facebookPageId=\{fbPageId\}/);
  assert.match(assistant, /api\/services\?facebookPageId=/);
  assert.match(assistant, /facebookPageId,/);
  assert.match(assistant, /Fallback bảo thủ/);
  assert.match(assistant, /Ước tính AI/);
});
