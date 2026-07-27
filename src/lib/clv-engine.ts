import { prisma } from "@/lib/db";
import { churnRisk, clvTier, rfmScore, upsellSuggestion, type ChurnRisk, type CLVTier } from "@/lib/clv-policy";

export type { CLVTier, ChurnRisk } from "@/lib/clv-policy";

export interface CustomerCLV {
  customerId: string;
  name: string;
  phone: string | null;
  segment: string;
  clvTotal: number;          // tổng chi tiêu VND
  clvTier: CLVTier;
  bookingCount: number;
  avgOrderValue: number;
  avgVisitDays: number;      // trung bình số ngày giữa 2 visit (0 = chưa đủ data)
  daysSinceLastBooking: number;
  churnRisk: ChurnRisk;
  rfmScore: number;          // 1-125
  rfm: { r: number; f: number; m: number }; // each 1-5
  lastBookingAt: Date | null;
  services: string[];        // danh sách dịch vụ đã dùng
  upsellSuggestion: string | null;
}

export async function computeAllCLV(): Promise<CustomerCLV[]> {
  const [customers, bookings] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.bookingRevenue.findMany({ orderBy: { paidAt: "asc" } }),
  ]);

  // Group bookings by customerId
  const byCustomer: Record<string, typeof bookings> = {};
  for (const b of bookings) {
    if (!b.customerId) continue;
    if (!byCustomer[b.customerId]) byCustomer[b.customerId] = [];
    byCustomer[b.customerId].push(b);
  }

  const now = Date.now();

  // Global max values for RFM normalization
  const allCounts = customers.map(c => byCustomer[c.id]?.length ?? 0);
  const allTotals = customers.map(c => byCustomer[c.id]?.reduce((s, b) => s + b.amount, 0) ?? 0);
  const allDaysSince = customers.map(c => {
    const bs = byCustomer[c.id];
    if (!bs?.length) return 365;
    return Math.round((now - new Date(bs[bs.length - 1].paidAt).getTime()) / 86400000);
  });
  const maxCount = Math.max(...allCounts, 1);
  const maxTotal = Math.max(...allTotals, 1);
  const maxDays  = Math.max(...allDaysSince, 1);

  const results: CustomerCLV[] = customers.map((c, idx) => {
    const bs = byCustomer[c.id] ?? [];
    const total = bs.reduce((s, b) => s + b.amount, 0);
    const count = bs.length;
    const avgOrder = count > 0 ? Math.round(total / count) : 0;
    const services = [...new Set(bs.map(b => b.service).filter(Boolean) as string[])];

    // Average visit interval
    let avgDays = 0;
    if (bs.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < bs.length; i++) {
        diffs.push((new Date(bs[i].paidAt).getTime() - new Date(bs[i-1].paidAt).getTime()) / 86400000);
      }
      avgDays = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
    }

    const lastBooking = bs.length > 0 ? new Date(bs[bs.length - 1].paidAt) : null;
    const daysSince = lastBooking ? Math.round((now - lastBooking.getTime()) / 86400000) : 999;

    const rfm = rfmScore(allDaysSince[idx], count, total, maxDays, maxCount, maxTotal);

    return {
      customerId: c.id,
      name: c.name,
      phone: c.phone ?? null,
      segment: c.segment,
      clvTotal: total,
      clvTier: clvTier(total),
      bookingCount: count,
      avgOrderValue: avgOrder,
      avgVisitDays: avgDays,
      daysSinceLastBooking: daysSince,
      churnRisk: churnRisk(daysSince, avgDays),
      rfmScore: rfm.r * rfm.f * rfm.m,
      rfm,
      lastBookingAt: lastBooking,
      services,
      upsellSuggestion: upsellSuggestion(services),
    };
  });

  return results.sort((a, b) => b.clvTotal - a.clvTotal);
}

// Cache CLV into Customer rows (called by cron)
export async function updateCachedCLV() {
  const all = await computeAllCLV();
  const now = new Date();
  await Promise.all(
    all.map(c =>
      prisma.customer.update({
        where: { id: c.customerId },
        data: {
          clvTotal: c.clvTotal,
          clvTier: c.clvTier,
          churnRisk: c.churnRisk,
          rfmScore: c.rfmScore,
          avgVisitDays: c.avgVisitDays,
          lastBookingAt: c.lastBookingAt,
          clvUpdatedAt: now,
        },
      })
    )
  );
  return all.length;
}
