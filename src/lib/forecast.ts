import { prisma } from "./db";
import { quickCritique } from "./ai-council";

export type Scenario = "baseline" | "ads_2x" | "promo_30" | "tet_boost";

export interface ForecastDay {
  date: string;          // YYYY-MM-DD
  predicted: number;     // VND
  lowerBound: number;
  upperBound: number;
  factors: string[];     // ["weekend +20%", "tet_holiday +50%"]
}

const SCENARIO_MULTIPLIER: Record<Scenario, number> = {
  baseline: 1.0,
  ads_2x: 1.35,        // gấp đôi ads ≈ revenue tăng 35% (giảm marginal return)
  promo_30: 1.20,      // 30% discount → traffic + conversion tăng
  tet_boost: 1.50,     // Tết → đỉnh điểm spa
};

// Vietnamese weekend pattern for beauty/spa
const WEEKDAY_MULTIPLIER = [
  0.95,  // Sunday  (CN)
  0.85,  // Monday  (T2 — quiet)
  0.90,  // Tuesday (T3)
  0.95,  // Wednesday
  1.05,  // Thursday
  1.20,  // Friday  — getting ready for weekend
  1.30,  // Saturday — peak
];

// Major Vietnamese holidays boost factor (apply to dates within window)
const HOLIDAY_BOOST: Record<string, number> = {
  "Tết": 1.5,
  "8/3": 1.4,
  "20/10": 1.3,
  "Valentine": 1.2,
  "Lễ": 1.15,
};

function detectHolidayBoost(date: Date, holidays: { name: string; date: string }[]): { boost: number; name: string | null } {
  const dStr = date.toISOString().slice(0, 10);

  // Direct match
  const direct = holidays.find((h) => h.date === dStr);
  if (direct) {
    for (const [key, mult] of Object.entries(HOLIDAY_BOOST)) {
      if (direct.name.toLowerCase().includes(key.toLowerCase())) return { boost: mult, name: direct.name };
    }
    return { boost: 1.1, name: direct.name };
  }

  // Within 3 days before a major holiday → pre-holiday rush
  for (const h of holidays) {
    const hDate = new Date(h.date);
    const diff = (hDate.getTime() - date.getTime()) / 86400000;
    if (diff > 0 && diff <= 3) {
      for (const [key, mult] of Object.entries(HOLIDAY_BOOST)) {
        if (h.name.toLowerCase().includes(key.toLowerCase())) {
          return { boost: 1 + (mult - 1) * 0.6, name: `chuẩn bị ${h.name}` };
        }
      }
    }
  }

  return { boost: 1.0, name: null };
}

interface HistoryStats {
  dailyAvg: number;
  std: number;
  weeklyAvg: number[];   // index 0=Sun ... 6=Sat
  daysWithData: number;
}

async function computeHistoryStats(): Promise<HistoryStats> {
  const since = new Date(Date.now() - 90 * 86400000);
  const revenues = await prisma.bookingRevenue.findMany({
    where: { paidAt: { gte: since } },
    select: { amount: true, paidAt: true },
  });

  if (revenues.length === 0) {
    return { dailyAvg: 0, std: 0, weeklyAvg: Array(7).fill(0), daysWithData: 0 };
  }

  // Bucket by date
  const byDate = new Map<string, number>();
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const byWeekdayCount = [0, 0, 0, 0, 0, 0, 0];

  for (const r of revenues) {
    const key = r.paidAt.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + r.amount);
    const wd = r.paidAt.getDay();
    byWeekday[wd] += r.amount;
    byWeekdayCount[wd]++;
  }

  const totals = Array.from(byDate.values());
  const dailyAvg = totals.reduce((s, v) => s + v, 0) / totals.length;
  const variance = totals.reduce((s, v) => s + Math.pow(v - dailyAvg, 2), 0) / totals.length;
  const std = Math.sqrt(variance);

  const weeklyAvg = byWeekday.map((total, i) => (byWeekdayCount[i] > 0 ? total / byWeekdayCount[i] : dailyAvg));

  return { dailyAvg, std, weeklyAvg, daysWithData: byDate.size };
}

export async function computeForecast(opts: {
  horizonDays?: number;
  scenario?: Scenario;
  save?: boolean;
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

  // AI Council validates (best effort)
  let notes = `Dự báo dựa trên ${stats.daysWithData} ngày data lịch sử. Avg daily: ${Math.round(baseDaily).toLocaleString("vi-VN")}đ. Confidence: ${Math.round(confidence * 100)}%`;
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
    // council failed — keep statistical notes
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
