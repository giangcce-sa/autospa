import { prisma } from "./db";
import { quickCritique } from "./ai-council";
import {
  SCENARIO_MULTIPLIER,
  WEEKDAY_MULTIPLIER,
  computeStatsFromRevenues,
  detectHolidayBoost,
  type HistoryStats,
  type Scenario,
} from "./forecast-policy";

export type { Scenario } from "./forecast-policy";

export interface ForecastDay {
  date: string;          // YYYY-MM-DD
  predicted: number;     // VND
  lowerBound: number;
  upperBound: number;
  factors: string[];     // ["weekend +20%", "tet_holiday +50%"]
}

async function computeHistoryStats(): Promise<HistoryStats> {
  const since = new Date(Date.now() - 90 * 86400000);
  const revenues = await prisma.bookingRevenue.findMany({
    where: { paidAt: { gte: since } },
    select: { amount: true, paidAt: true },
  });

  return computeStatsFromRevenues(revenues);
}

export async function computeForecast(opts: {
  horizonDays?: number;
  scenario?: Scenario;
  save?: boolean;
  useCouncil?: boolean;
}): Promise<{ id?: string; days: ForecastDay[]; total: number; confidence: number; notes: string }> {
  const horizon = opts.horizonDays ?? 30;
  const scenario = opts.scenario ?? "baseline";
  const scenarioMult = SCENARIO_MULTIPLIER[scenario];

  const stats = await computeHistoryStats();
  const holidays = await prisma.holidayEvent.findMany({
    where: { isActive: true },
    select: { name: true, date: true },
  });

  // If no history, fallback to a flat estimate
  const baseDaily = stats.dailyAvg > 0 ? stats.dailyAvg : 500000; // 500K default
  const confidence = stats.daysWithData >= 14 ? Math.min(0.85, stats.daysWithData / 90) : 0.3;

  const days: ForecastDay[] = [];
  let total = 0;

  for (let i = 1; i <= horizon; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const wd = date.getDay();

    const weekdayFactor = stats.weeklyAvg[wd] > 0 ? stats.weeklyAvg[wd] / baseDaily : WEEKDAY_MULTIPLIER[wd];
    const holiday = detectHolidayBoost(date, holidays);

    const factors: string[] = [];
    if (weekdayFactor > 1.1) factors.push(`${["CN","T2","T3","T4","T5","T6","T7"][wd]} +${Math.round((weekdayFactor - 1) * 100)}%`);
    else if (weekdayFactor < 0.95) factors.push(`${["CN","T2","T3","T4","T5","T6","T7"][wd]} ${Math.round((weekdayFactor - 1) * 100)}%`);
    if (holiday.boost !== 1.0) factors.push(`${holiday.name} +${Math.round((holiday.boost - 1) * 100)}%`);
    if (scenarioMult !== 1.0) factors.push(`scenario +${Math.round((scenarioMult - 1) * 100)}%`);

    const predicted = baseDaily * weekdayFactor * holiday.boost * scenarioMult;
    const margin = stats.std * 0.5;
    const lowerBound = Math.max(0, predicted - margin);
    const upperBound = predicted + margin;

    days.push({
      date: date.toISOString().slice(0, 10),
      predicted: Math.round(predicted),
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound),
      factors,
    });
    total += predicted;
  }

  total = Math.round(total);

  let notes = `Dự báo dựa trên ${stats.daysWithData} ngày data lịch sử. Avg daily: ${Math.round(baseDaily).toLocaleString("vi-VN")}đ. Confidence: ${Math.round(confidence * 100)}%`;
  if (opts.useCouncil !== false) {
    try {
      const context = `Dự báo doanh thu ${horizon} ngày tới = ${total.toLocaleString("vi-VN")}đ.
Avg daily history: ${Math.round(baseDaily).toLocaleString("vi-VN")}đ (${stats.daysWithData} ngày data)
Std dev: ${Math.round(stats.std).toLocaleString("vi-VN")}đ
Scenario: ${scenario} (multiplier ${scenarioMult})
Holidays trong horizon: ${days.filter(d => d.factors.some(f => f.includes("+"))).length} ngày có boost`;

      const council = await quickCritique({
        topic: `Dự báo doanh thu spa ${horizon} ngày tới có hợp lý không?`,
        context,
      });
      notes = council.synthesis.slice(0, 800);
    } catch {
      // Keep statistical notes if Council is unavailable.
    }
  }

  let savedId: string | undefined;
  if (opts.save) {
    const saved = await prisma.revenueForecast.create({
      data: {
        horizonDays: horizon,
        scenario,
        forecast: JSON.stringify(days),
        totalPredicted: total,
        confidence,
        notes,
      },
    });
    savedId = saved.id;
  }

  return { id: savedId, days, total, confidence, notes };
}
