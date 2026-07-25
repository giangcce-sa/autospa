import "server-only";

import { computeAllCLV, type ChurnRisk, type CLVTier } from "@/lib/clv-engine";

export interface CustomerCLVData {
  customerId: string;
  name: string;
  phone: string | null;
  segment: string;
  clvTotal: number;
  clvTier: CLVTier;
  bookingCount: number;
  avgOrderValue: number;
  avgVisitDays: number;
  daysSinceLastBooking: number;
  churnRisk: ChurnRisk;
  rfmScore: number;
  rfm: { r: number; f: number; m: number };
  services: string[];
  upsellSuggestion: string | null;
}

export interface CustomerCLVSummaryData {
  total: number;
  avgCLV: number;
  tiers: { premium: number; high: number; mid: number; low: number };
  churn: { high: number; medium: number; low: number };
  atRisk: CustomerCLVData[];
  topCustomers: CustomerCLVData[];
}

export async function getCustomerCLVSummary(): Promise<CustomerCLVSummaryData> {
  const all = await computeAllCLV();
  const serializable = all.map((customer) => ({
    customerId: customer.customerId,
    name: customer.name,
    phone: customer.phone,
    segment: customer.segment,
    clvTotal: customer.clvTotal,
    clvTier: customer.clvTier,
    bookingCount: customer.bookingCount,
    avgOrderValue: customer.avgOrderValue,
    avgVisitDays: customer.avgVisitDays,
    daysSinceLastBooking: customer.daysSinceLastBooking,
    churnRisk: customer.churnRisk,
    rfmScore: customer.rfmScore,
    rfm: customer.rfm,
    services: customer.services,
    upsellSuggestion: customer.upsellSuggestion,
  }));
  return {
    total: serializable.length,
    avgCLV: serializable.length ? Math.round(serializable.reduce((sum, customer) => sum + customer.clvTotal, 0) / serializable.length) : 0,
    tiers: {
      premium: serializable.filter((customer) => customer.clvTier === "premium").length,
      high: serializable.filter((customer) => customer.clvTier === "high").length,
      mid: serializable.filter((customer) => customer.clvTier === "mid").length,
      low: serializable.filter((customer) => customer.clvTier === "low").length,
    },
    churn: {
      high: serializable.filter((customer) => customer.churnRisk === "high").length,
      medium: serializable.filter((customer) => customer.churnRisk === "medium").length,
      low: serializable.filter((customer) => customer.churnRisk === "low").length,
    },
    atRisk: serializable.filter((customer) => customer.churnRisk === "high").slice(0, 10),
    topCustomers: serializable.slice(0, 10),
  };
}
