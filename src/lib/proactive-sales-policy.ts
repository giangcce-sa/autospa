// Pure proactive-sales policy — no prisma, no server-only. Importable from node tests.

export type TriggerType = "cold_reactivation" | "birthday" | "vip_loyal" | "post_nps";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  fbId: string | null;
  birthday: string | null;
  segment: string;
  lastContact: Date | null;
  npsScore: number | null;
}

export interface Trigger {
  type: TriggerType;
  reason: string;
}

export function pickTrigger(customer: Customer, now: Date): Trigger | null {
  const daysSinceContact = customer.lastContact
    ? (now.getTime() - customer.lastContact.getTime()) / 86400000
    : 999;

  // 4. Post-NPS upsell — high NPS + chưa quay lại 45 ngày
  if (customer.npsScore !== null && customer.npsScore >= 4 && daysSinceContact > 45) {
    return { type: "post_nps", reason: `Khách yêu thích (${customer.npsScore}⭐) — ${Math.round(daysSinceContact)} ngày chưa quay lại` };
  }

  // 1. Cold reactivation — > 60 ngày
  if (daysSinceContact > 60) {
    return { type: "cold_reactivation", reason: `${Math.round(daysSinceContact)} ngày chưa liên hệ` };
  }

  // 2. Birthday — trong 7 ngày tới
  if (customer.birthday) {
    try {
      // birthday format: "MM-DD" or "YYYY-MM-DD"
      const parts = customer.birthday.split("-");
      const month = parts.length === 3 ? parseInt(parts[1]) - 1 : parseInt(parts[0]) - 1;
      const day = parts.length === 3 ? parseInt(parts[2]) : parseInt(parts[1]);

      const thisYearBday = new Date(now.getFullYear(), month, day);
      if (thisYearBday < now) thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
      const daysToBday = (thisYearBday.getTime() - now.getTime()) / 86400000;
      if (daysToBday >= 0 && daysToBday <= 7) {
        return { type: "birthday", reason: `Sinh nhật trong ${Math.round(daysToBday)} ngày` };
      }
    } catch { /* invalid birthday format */ }
  }

  // 3. VIP loyal — segment vip + > 30 ngày
  if (customer.segment === "vip" && daysSinceContact > 30) {
    return { type: "vip_loyal", reason: `Khách VIP — ${Math.round(daysSinceContact)} ngày chưa chăm sóc` };
  }

  return null;
}
