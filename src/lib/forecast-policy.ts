// Pure forecast policy — no prisma, no server-only. Importable from node tests.
import { businessDateKey, nextAnnualBusinessOccurrence } from "./today-policy.ts";

export type Scenario = "baseline" | "ads_2x" | "promo_30" | "tet_boost";

export const SCENARIO_MULTIPLIER: Record<Scenario, number> = {
  baseline: 1.0,
  ads_2x: 1.35,        // gấp đôi ads ≈ revenue tăng 35% (giảm marginal return)
  promo_30: 1.20,      // 30% discount → traffic + conversion tăng
  tet_boost: 1.50,     // Tết → đỉnh điểm spa
};

// Vietnamese weekend pattern for beauty/spa
export const WEEKDAY_MULTIPLIER = [
  0.95,  // Sunday  (CN)
  0.85,  // Monday  (T2 — quiet)
  0.90,  // Tuesday (T3)
  0.95,  // Wednesday
  1.05,  // Thursday
  1.20,  // Friday  — getting ready for weekend
  1.30,  // Saturday — peak
];

// Major Vietnamese holidays boost factor (apply to dates within window)
export const HOLIDAY_BOOST: Record<string, number> = {
  "Tết": 1.5,
  "8/3": 1.4,
  "20/10": 1.3,
  "Valentine": 1.2,
  "Lễ": 1.15,
};

export function detectHolidayBoost(date: Date, holidays: { name: string; date: string }[]): { boost: number; name: string | null } {
  const dateKey = businessDateKey(date);

  for (const holiday of holidays) {
    const occurrence = nextAnnualBusinessOccurrence(holiday.date, new Date(date.getTime() - 4 * 86400000));
    const occurrenceKey = businessDateKey(occurrence.eventDate);
    if (occurrenceKey === dateKey) {
      for (const [key, multiplier] of Object.entries(HOLIDAY_BOOST)) {
        if (holiday.name.toLowerCase().includes(key.toLowerCase())) return { boost: multiplier, name: holiday.name };
      }
      return { boost: 1.1, name: holiday.name };
    }

    const difference = Math.round((occurrence.eventDate.getTime() - date.getTime()) / 86400000);
    if (difference > 0 && difference <= 3) {
      for (const [key, multiplier] of Object.entries(HOLIDAY_BOOST)) {
        if (holiday.name.toLowerCase().includes(key.toLowerCase())) {
          return { boost: 1 + (multiplier - 1) * 0.6, name: `chuẩn bị ${holiday.name}` };
        }
      }
    }
  }

  return { boost: 1.0, name: null };
}

export interface HistoryStats {
  dailyAvg: number;
  std: number;
  weeklyAvg: number[];   // index 0=Sun ... 6=Sat
  daysWithData: number;
}

export function computeStatsFromRevenues(revenues: { amount: number; paidAt: Date }[]): HistoryStats {
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
