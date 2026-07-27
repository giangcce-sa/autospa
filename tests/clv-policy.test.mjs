import assert from "node:assert/strict";
import test from "node:test";
import {
  churnRisk,
  clvTier,
  rfmScore,
  summarizeClv,
  upsellSuggestion,
} from "../src/lib/clv-policy.ts";

test("CLV tiers switch exactly at the 500K / 2M / 5M boundaries", () => {
  assert.equal(clvTier(0), "low");
  assert.equal(clvTier(499_999), "low");
  assert.equal(clvTier(500_000), "mid");
  assert.equal(clvTier(1_999_999), "mid");
  assert.equal(clvTier(2_000_000), "high");
  assert.equal(clvTier(4_999_999), "high");
  assert.equal(clvTier(5_000_000), "premium");
});

test("Churn risk stays low without visit history and switches at 1.4 and 2.0 ratios", () => {
  assert.equal(churnRisk(500, 0), "low");
  assert.equal(churnRisk(139, 100), "low");
  assert.equal(churnRisk(140, 100), "medium");
  assert.equal(churnRisk(199, 100), "medium");
  assert.equal(churnRisk(200, 100), "high");
});

test("RFM scores normalize against maxima and clamp to 1..5", () => {
  assert.deepEqual(rfmScore(0, 10, 1000, 100, 10, 1000), { r: 5, f: 5, m: 5 });
  assert.deepEqual(rfmScore(100, 0, 0, 100, 10, 1000), { r: 1, f: 1, m: 1 });
  assert.deepEqual(rfmScore(50, 5, 500, 100, 10, 1000), { r: 3, f: 3, m: 3 });
  // Values above the max still clamp to 5, zero maxima are guarded to 1.
  assert.deepEqual(rfmScore(0, 6, 5, 0, 5, 0), { r: 5, f: 5, m: 5 });
});

test("Upsell rules route by service keywords and single-service fallback", () => {
  assert.equal(upsellSuggestion(["Facial trẻ hóa", "Nail"]), "Dermapen — phù hợp sau liệu trình facial");
  assert.equal(upsellSuggestion(["Massage đá nóng", "Gội đầu"]), "Body Wrap — combo tốt sau massage");
  assert.equal(upsellSuggestion(["Nail gel", "Gội đầu"]), "Facial — combo nail + facial được yêu thích");
  assert.equal(upsellSuggestion(["Wax chân", "Gội đầu"]), "Liệu trình dưỡng ẩm sau wax");
  assert.equal(upsellSuggestion(["Gội đầu dưỡng sinh"]), "Thử thêm dịch vụ mới — khách dùng 2+ dịch vụ giữ lâu hơn 3x");
  assert.equal(upsellSuggestion(["Facial", "Dermapen"]), null);
  assert.equal(upsellSuggestion(["Gội đầu", "Xông hơi"]), null);
});

test("CLV summary buckets tiers and churn, rounds avgCLV, and slices lists to 10", () => {
  const row = (clvTotal, clvTier, churnRisk) => ({ clvTotal, clvTier, churnRisk });
  const rows = [
    row(6_000_000, "premium", "high"),
    row(3_000_000, "high", "medium"),
    row(2_500_000, "high", "low"),
    row(700_000, "mid", "low"),
    row(100_000, "low", "low"),
  ];

  const summary = summarizeClv(rows);
  assert.equal(summary.total, 5);
  assert.equal(summary.avgCLV, Math.round(12_300_000 / 5));
  assert.deepEqual(summary.tiers, { premium: 1, high: 2, mid: 1, low: 1 });
  assert.deepEqual(summary.churn, { high: 1, medium: 1, low: 3 });
  assert.deepEqual(summary.atRisk, [rows[0]]);
  assert.deepEqual(summary.topCustomers, rows);

  // avgCLV rounds half up.
  assert.equal(summarizeClv([row(1000, "low", "low"), row(2001, "low", "low")]).avgCLV, 1501);

  // atRisk and topCustomers are capped at 10 entries.
  const many = Array.from({ length: 12 }, (_, index) => row(index, "low", "high"));
  const capped = summarizeClv(many);
  assert.equal(capped.total, 12);
  assert.equal(capped.atRisk.length, 10);
  assert.equal(capped.topCustomers.length, 10);
});

test("Empty CLV summary reports zeros without dividing by zero", () => {
  assert.deepEqual(summarizeClv([]), {
    total: 0,
    avgCLV: 0,
    tiers: { premium: 0, high: 0, mid: 0, low: 0 },
    churn: { high: 0, medium: 0, low: 0 },
    atRisk: [],
    topCustomers: [],
  });
});
