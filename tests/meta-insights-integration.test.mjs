import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Meta Insights route validates the shared date preset", async () => {
  const route = await source("src/app/api/facebook-ads/route.ts");
  assert.match(route, /parseMetaInsightsDatePreset\(searchParams\.get\("datePreset"\) \?\? "last_7d"\)/);
  assert.match(route, /await requirePageAccess\(facebookPageId\)/);
});

test("Meta Insights library builds URLs safely and uses bounded pagination for both levels", async () => {
  const ads = await source("src/lib/facebook-ads.ts");
  assert.match(ads, /new URL\(`\$\{FB\}\/\$\{actId\}\/insights`\)/);
  assert.match(ads, /url\.searchParams\.set\("date_preset", datePreset\)/);
  assert.equal((ads.match(/readMetaInsightsPages\(/g) ?? []).length, 2);
  assert.match(ads, /campaign_id,campaign_name/);
  assert.match(ads, /id: campaign\.campaign_id/);
});

test("Growth and Ads UI share presets, nullable metrics and stable campaign IDs", async () => {
  const [growth, insights] = await Promise.all([
    source("src/components/modules/growth/GrowthAdsWorkspace.tsx"),
    source("src/components/modules/facebook-ads/AdsInsights.tsx"),
  ]);
  assert.match(growth, /META_INSIGHTS_DATE_PRESETS/);
  assert.match(insights, /META_INSIGHTS_DATE_PRESET_OPTIONS/);
  assert.match(insights, /value === null \? "—"/);
  assert.match(insights, /key=\{c\.id\}/);
});
