// Pure flash-deal policy — no prisma, no server-only. Importable from node tests.
import { businessDateKey } from "./today-policy.ts";

export interface SlotGap {
  date: string;       // YYYY-MM-DD
  label: string;      // "Thứ 3, 17/06"
  hoursUntil: number; // giờ còn lại đến ngày đó
  filledSlots: number;
  estimatedCapacity: number;
  fillRate: number;   // 0-1
}

// Estimate capacity: default 8 slots/day, can be overridden in settings
export const DEFAULT_CAPACITY = 8;

export function dayLabel(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export function businessDayAtNine(date: Date) {
  return new Date(`${businessDateKey(date)}T09:00:00+07:00`);
}

// Find gaps: days in the next 48h with fill rate < 60%
export function computeSlotGaps(
  appts: { preferredAt: Date | string | null }[],
  now: Date,
  capacity = DEFAULT_CAPACITY,
): SlotGap[] {
  const cutoff = new Date(now.getTime() + 48 * 3600000);

  const byDay: Record<string, number> = {};
  for (const a of appts) {
    if (!a.preferredAt) continue;
    const appointment = new Date(a.preferredAt);
    if (appointment < now || appointment > cutoff) continue;
    const key = businessDateKey(appointment);
    byDay[key] = (byDay[key] ?? 0) + 1;
  }

  // Build slot map for next 2 days
  const gaps: SlotGap[] = [];
  for (let i = 0; i <= 2; i++) {
    const date = new Date(now.getTime() + i * 86400000);
    const key = businessDateKey(date);
    const filled = byDay[key] ?? 0;
    const fillRate = filled / capacity;
    const slotTime = businessDayAtNine(date);
    const hoursUntil = Math.round((slotTime.getTime() - now.getTime()) / 3600000);

    if (fillRate < 0.6 && hoursUntil > 2 && slotTime <= cutoff) {
      gaps.push({
        date: key,
        label: dayLabel(slotTime),
        hoursUntil: Math.max(0, hoursUntil),
        filledSlots: filled,
        estimatedCapacity: capacity,
        fillRate,
      });
    }
  }

  return gaps;
}

// Calculate optimal discount: emptier = deeper discount
export function calcDiscount(fillRate: number, hoursUntil: number): number {
  let base = 0;
  if (fillRate < 0.2) base = 30;
  else if (fillRate < 0.4) base = 20;
  else base = 10;

  // Urgency bonus: < 12h → extra 5%
  if (hoursUntil < 12) base += 5;
  return Math.min(base, 35); // cap at 35%
}
