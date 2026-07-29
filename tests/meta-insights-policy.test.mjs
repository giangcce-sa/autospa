import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMetaMetric,
  parseMetaInsightsDatePreset,
  readMetaInsightsPages,
} from "../src/lib/meta-insights-policy.ts";

function response(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("Meta Insights accepts only the shared date presets", () => {
  assert.equal(parseMetaInsightsDatePreset("last_7d"), "last_7d");
  assert.equal(parseMetaInsightsDatePreset("this_month"), "this_month");
  assert.throws(() => parseMetaInsightsDatePreset("maximum"), /không hợp lệ/);
});

test("Meta Insights metrics preserve unavailable separately from zero", () => {
  assert.equal(normalizeMetaMetric("0"), "0");
  assert.equal(normalizeMetaMetric(" 12.50 "), "12.5");
  assert.equal(normalizeMetaMetric(7), "7");
  assert.equal(normalizeMetaMetric(""), null);
  assert.equal(normalizeMetaMetric("NaN"), null);
  assert.equal(normalizeMetaMetric(-1), null);
  assert.equal(normalizeMetaMetric(undefined), null);
});

test("Meta Insights paginates sanitized URLs without exposing paging tokens", async () => {
  const requests = [];
  const rows = await readMetaInsightsPages(
    "https://graph.facebook.com/v21.0/act_1/insights?limit=100",
    "secret-token",
    async (url, init) => {
      requests.push({ url: String(url), authorization: init?.headers?.Authorization });
      if (requests.length === 1) {
        return response({
          data: [{ campaign_id: "campaign-1", spend: "10" }],
          paging: { next: "https://graph.facebook.com/v21.0/act_1/insights?after=cursor&access_token=paging-secret" },
        });
      }
      return response({ data: [{ campaign_id: "campaign-2", spend: "20" }] });
    },
  );

  assert.deepEqual(rows.map((row) => row.campaign_id), ["campaign-1", "campaign-2"]);
  assert.equal(requests[0].authorization, "Bearer secret-token");
  assert.equal(requests[1].authorization, "Bearer secret-token");
  assert.doesNotMatch(requests[1].url, /access_token/);
});

test("Meta Insights rejects HTTP errors, Graph errors and repeated paging URLs", async () => {
  await assert.rejects(
    readMetaInsightsPages("https://graph.facebook.com/v21.0/insights", "token", async () => response({}, { status: 503 })),
    /HTTP 503/,
  );
  await assert.rejects(
    readMetaInsightsPages("https://graph.facebook.com/v21.0/insights", "token", async () => response({ error: { message: "Permission denied" } })),
    /Permission denied/,
  );
  await assert.rejects(
    readMetaInsightsPages("https://graph.facebook.com/v21.0/insights", "token", async (url) => response({ paging: { next: String(url) } })),
    /paging bị lặp/,
  );
});

test("Meta Insights rejects paging away from the Meta Graph host", async () => {
  await assert.rejects(
    readMetaInsightsPages(
      "https://graph.facebook.com/v21.0/insights",
      "token",
      async () => response({ paging: { next: "https://example.com/steal" } }),
    ),
    /paging URL không hợp lệ/,
  );
});
