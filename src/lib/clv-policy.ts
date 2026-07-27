// Pure CLV policy — no prisma, no server-only. Importable from node tests.

export type CLVTier = "low" | "mid" | "high" | "premium";
export type ChurnRisk = "low" | "medium" | "high";

export function clvTier(total: number): CLVTier {
  if (total >= 5_000_000) return "premium";
  if (total >= 2_000_000) return "high";
  if (total >= 500_000)   return "mid";
  return "low";
}

export function churnRisk(daysSince: number, avgVisit: number): ChurnRisk {
  if (avgVisit === 0) return "low"; // chưa đủ data → không alert
  const ratio = daysSince / avgVisit;
  if (ratio >= 2.0) return "high";
  if (ratio >= 1.4) return "medium";
  return "low";
}

// RFM score 1-5 per dimension
export function rfmScore(daysSince: number, count: number, total: number, maxDays: number, maxCount: number, maxTotal: number) {
  const r = Math.ceil(5 - (daysSince / Math.max(maxDays, 1)) * 4); // recent = high score
  const f = Math.ceil((count / Math.max(maxCount, 1)) * 5);
  const m = Math.ceil((total / Math.max(maxTotal, 1)) * 5);
  return {
    r: Math.min(5, Math.max(1, r)),
    f: Math.min(5, Math.max(1, f)),
    m: Math.min(5, Math.max(1, m)),
  };
}

// Simple rule-based upsell suggestion
export function upsellSuggestion(services: string[]): string | null {
  const s = services.map(x => x.toLowerCase()).join(" ");
  if (s.includes("facial") && !s.includes("dermapen")) return "Dermapen — phù hợp sau liệu trình facial";
  if (s.includes("massage") && !s.includes("body wrap")) return "Body Wrap — combo tốt sau massage";
  if (s.includes("nail") && !s.includes("facial")) return "Facial — combo nail + facial được yêu thích";
  if (s.includes("wax") && !s.includes("kem dưỡng")) return "Liệu trình dưỡng ẩm sau wax";
  if (services.length === 1) return "Thử thêm dịch vụ mới — khách dùng 2+ dịch vụ giữ lâu hơn 3x";
  return null;
}

export interface ClvSummaryRow {
  clvTotal: number;
  clvTier: CLVTier;
  churnRisk: ChurnRisk;
}

export function summarizeClv<T extends ClvSummaryRow>(rows: T[]) {
  return {
    total: rows.length,
    avgCLV: rows.length ? Math.round(rows.reduce((sum, customer) => sum + customer.clvTotal, 0) / rows.length) : 0,
    tiers: {
      premium: rows.filter((customer) => customer.clvTier === "premium").length,
      high: rows.filter((customer) => customer.clvTier === "high").length,
      mid: rows.filter((customer) => customer.clvTier === "mid").length,
      low: rows.filter((customer) => customer.clvTier === "low").length,
    },
    churn: {
      high: rows.filter((customer) => customer.churnRisk === "high").length,
      medium: rows.filter((customer) => customer.churnRisk === "medium").length,
      low: rows.filter((customer) => customer.churnRisk === "low").length,
    },
    atRisk: rows.filter((customer) => customer.churnRisk === "high").slice(0, 10),
    topCustomers: rows.slice(0, 10),
  };
}
