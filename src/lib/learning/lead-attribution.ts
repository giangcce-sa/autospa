import { prisma } from "@/lib/db";

export interface SourceStat {
  source: string;
  totalLeads: number;
  converted: number;
  conversionRate: number;
  avgRevenue: number;
  weight: number;
}

// Runs nightly — recalculate conversion rates per lead source
export async function learnLeadAttribution(): Promise<{ updated: number; insights: string[] }> {
  const insights: string[] = [];

  // All leads with known source
  const leads = await prisma.lead.findMany({
    where: { source: { not: "" } },
    select: { source: true, stage: true, customerId: true },
  });

  if (leads.length === 0) return { updated: 0, insights: ["Chưa có dữ liệu lead"] };

  // Group by source
  const sourceMap: Record<string, { total: number; converted: number; customerIds: string[] }> = {};
  for (const lead of leads) {
    const s = lead.source || "unknown";
    if (!sourceMap[s]) sourceMap[s] = { total: 0, converted: 0, customerIds: [] };
    sourceMap[s].total += 1;
    if (lead.stage === "closed" || lead.stage === "converted") {
      sourceMap[s].converted += 1;
      if (lead.customerId) sourceMap[s].customerIds.push(lead.customerId);
    }
  }

  // Get revenue per customer
  const revenues = await prisma.bookingRevenue.groupBy({
    by: ["customerId"],
    _sum: { amount: true },
    where: { customerId: { not: null } },
  });
  const revenueMap: Record<string, number> = {};
  for (const r of revenues) {
    if (r.customerId) revenueMap[r.customerId] = r._sum.amount ?? 0;
  }

  // Compute stats and upsert
  const results: SourceStat[] = [];
  for (const [source, data] of Object.entries(sourceMap)) {
    const convRate = data.total > 0 ? data.converted / data.total : 0;
    const totalRev = data.customerIds.reduce((s, id) => s + (revenueMap[id] ?? 0), 0);
    const avgRev = data.converted > 0 ? Math.round(totalRev / data.converted) : 0;

    // Weight: higher conversion + revenue → higher weight (1.0 = baseline)
    const weight = Math.min(3.0, 0.5 + convRate * 2 + (avgRev > 500000 ? 0.5 : 0));

    await prisma.leadSourceWeight.upsert({
      where: { source },
      update: { totalLeads: data.total, converted: data.converted, conversionRate: convRate, avgRevenue: avgRev, weight },
      create: { source, totalLeads: data.total, converted: data.converted, conversionRate: convRate, avgRevenue: avgRev, weight },
    });

    results.push({ source, totalLeads: data.total, converted: data.converted, conversionRate: convRate, avgRevenue: avgRev, weight });
  }

  // Top insight
  const best = results.sort((a, b) => b.conversionRate - a.conversionRate)[0];
  if (best) {
    insights.push(`Nguồn "${best.source}" convert tốt nhất: ${(best.conversionRate * 100).toFixed(0)}%`);
  }
  const worstByWeight = results.sort((a, b) => a.weight - b.weight)[0];
  if (worstByWeight && worstByWeight.totalLeads > 5) {
    insights.push(`Nguồn "${worstByWeight.source}" hiệu quả thấp → giảm ưu tiên`);
  }

  await prisma.learningInsight.create({
    data: {
      loop: "lead",
      insight: insights.join(" · "),
      confidence: Math.min(leads.length / 100, 1),
      appliedTo: "lead-scoring",
    },
  });

  return { updated: results.length, insights };
}

// Returns ordered source weights for use in lead scoring
export async function getSourceWeights(): Promise<Record<string, number>> {
  const weights = await prisma.leadSourceWeight.findMany();
  const map: Record<string, number> = {};
  for (const w of weights) map[w.source] = w.weight;
  return map;
}
