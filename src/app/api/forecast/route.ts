import { computeForecast } from "@/lib/forecast";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  horizonDays: z.enum(["7", "30", "90"]).transform(Number),
  scenario: z.enum(["baseline", "ads_2x", "promo_30", "tet_boost"]),
});

export async function GET(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { searchParams } = new URL(req.url);
    const { horizonDays, scenario } = querySchema.parse({
      horizonDays: searchParams.get("days") ?? "30",
      scenario: searchParams.get("scenario") ?? "baseline",
    });
    const result = await computeForecast({ horizonDays, scenario, save: false, useCouncil: false });
    return NextResponse.json({
      data: { ...result, scenario, horizonDays, provenance: { scope: "account", source: "BookingRevenue", windowDays: 90 } },
      success: true,
    });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi");
  }
}
