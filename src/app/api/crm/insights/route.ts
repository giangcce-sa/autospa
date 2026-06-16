import { NextRequest, NextResponse } from "next/server";
import { computeAllCLV, updateCachedCLV } from "@/lib/clv-engine";

export async function GET(req: NextRequest) {
  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "refresh") {
      const count = await updateCachedCLV();
      return NextResponse.json({ success: true, data: { updated: count } });
    }

    const all = await computeAllCLV();

    const summary = {
      total: all.length,
      avgCLV: all.length ? Math.round(all.reduce((s, c) => s + c.clvTotal, 0) / all.length) : 0,
      tiers: {
        premium: all.filter(c => c.clvTier === "premium").length,
        high:    all.filter(c => c.clvTier === "high").length,
        mid:     all.filter(c => c.clvTier === "mid").length,
        low:     all.filter(c => c.clvTier === "low").length,
      },
      churn: {
        high:   all.filter(c => c.churnRisk === "high").length,
        medium: all.filter(c => c.churnRisk === "medium").length,
        low:    all.filter(c => c.churnRisk === "low").length,
      },
      atRisk: all.filter(c => c.churnRisk === "high").slice(0, 10),
      topCustomers: all.slice(0, 10),
    };

    return NextResponse.json({ success: true, data: { summary, customers: all } });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
