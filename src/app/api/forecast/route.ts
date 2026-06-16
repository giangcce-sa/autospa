import { computeForecast, Scenario } from "@/lib/forecast";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const horizonDays = Number(searchParams.get("days") ?? 30);
    const scenario = (searchParams.get("scenario") ?? "baseline") as Scenario;

    const result = await computeForecast({ horizonDays, scenario, save: false });
    return NextResponse.json({ data: { ...result, scenario, horizonDays }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const horizonDays = Number(body.horizonDays ?? 30);
    const scenario = (body.scenario ?? "baseline") as Scenario;

    const result = await computeForecast({ horizonDays, scenario, save: true });
    return NextResponse.json({ data: { ...result, scenario, horizonDays }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
