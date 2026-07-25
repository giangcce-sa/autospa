export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";
const BUSINESS_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface TodayMetric<T> {
  value: T | null;
  availability: "available" | "unavailable" | "partial";
  scope: "current" | "all" | "account";
  window: string;
  source: string;
  asOf: string;
  warning?: string;
}

function shiftedParts(value: Date) {
  const shifted = new Date(value.getTime() + BUSINESS_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function fromBusinessMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day) - BUSINESS_OFFSET_MS);
}

export function getBusinessDayRange(now = new Date()) {
  const { year, month, day } = shiftedParts(now);
  return {
    start: fromBusinessMidnight(year, month, day),
    end: new Date(fromBusinessMidnight(year, month, day + 1).getTime() - 1),
  };
}

export function getBusinessMonthRange(now = new Date()) {
  const { year, month } = shiftedParts(now);
  return {
    start: fromBusinessMidnight(year, month, 1),
    end: new Date(fromBusinessMidnight(year, month + 1, 1).getTime() - 1),
  };
}

export function businessDateKey(now = new Date()) {
  const { year, month, day } = shiftedParts(now);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function businessMonthDay(now = new Date()) {
  const { month, day } = shiftedParts(now);
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`;
}

export function businessHour(now = new Date()) {
  return new Date(now.getTime() + BUSINESS_OFFSET_MS).getUTCHours();
}

export function nextAnnualBusinessOccurrence(monthDay: string, now = new Date()) {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!match) throw new RangeError("Ngày phải có định dạng MM-DD");
  const month = Number(match[1]);
  const day = Number(match[2]);
  const current = shiftedParts(now);
  const currentStart = fromBusinessMidnight(current.year, current.month, current.day);

  const occurrenceForYear = (year: number) => {
    const occurrence = fromBusinessMidnight(year, month - 1, day);
    const parts = shiftedParts(occurrence);
    return parts.year === year && parts.month === month - 1 && parts.day === day ? occurrence : null;
  };

  for (let year = current.year; year <= current.year + 8; year++) {
    const occurrence = occurrenceForYear(year);
    if (occurrence && occurrence >= currentStart) {
      return {
        eventDate: occurrence,
        daysUntil: Math.round((occurrence.getTime() - currentStart.getTime()) / 86400000),
      };
    }
  }

  throw new RangeError("Ngày không hợp lệ");
}

export function buildTodayQueueTotals(input: {
  pendingApprovals: number;
  reviewBlocked: number;
  openAlerts: number;
  criticalAlerts: number;
  hotLeads: number;
  unreadMessages: number;
  pendingAppointments: number;
  scheduledToday: number;
  careDue: number;
}) {
  return {
    total:
      input.pendingApprovals
      + input.reviewBlocked
      + input.openAlerts
      + input.hotLeads
      + input.unreadMessages
      + input.pendingAppointments
      + input.scheduledToday
      + input.careDue,
    critical: input.pendingApprovals + input.reviewBlocked + input.criticalAlerts,
  };
}
