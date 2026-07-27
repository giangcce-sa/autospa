import "server-only";

import { computeAllCLV, type ChurnRisk, type CLVTier } from "@/lib/clv-engine";
import { summarizeClv } from "@/lib/clv-policy";

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
  return summarizeClv(serializable);
}
