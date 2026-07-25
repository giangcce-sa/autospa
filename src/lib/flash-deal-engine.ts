import { prisma } from "@/lib/db";
import { generateChatCompletion } from "@/lib/openai";
import { businessDateKey } from "@/lib/today-policy";

export interface SlotGap {
  date: string;       // YYYY-MM-DD
  label: string;      // "Thứ 3, 17/06"
  hoursUntil: number; // giờ còn lại đến ngày đó
  filledSlots: number;
  estimatedCapacity: number;
  fillRate: number;   // 0-1
}

export interface FlashDeal {
  id: string;
  slotDate: string;
  discountPct: number;
  service: string | null;
  caption: string;
  status: "pending" | "approved" | "posted" | "expired";
  createdAt: Date;
}

// Estimate capacity: default 8 slots/day, can be overridden in settings
const DEFAULT_CAPACITY = 8;

function dayLabel(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function businessDayAtNine(date: Date) {
  return new Date(`${businessDateKey(date)}T09:00:00+07:00`);
}

// Find gaps: days in the next 48h with fill rate < 60%
export async function detectSlotGaps(): Promise<SlotGap[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 3600000);

  // Count confirmed/pending appointments per day in next 48h
  const appts = await prisma.appointmentRequest.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      preferredAt: { not: null },
    },
  });

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
    const fillRate = filled / DEFAULT_CAPACITY;
    const slotTime = businessDayAtNine(date);
    const hoursUntil = Math.round((slotTime.getTime() - now.getTime()) / 3600000);

    if (fillRate < 0.6 && hoursUntil > 2 && slotTime <= cutoff) {
      gaps.push({
        date: key,
        label: dayLabel(slotTime),
        hoursUntil: Math.max(0, hoursUntil),
        filledSlots: filled,
        estimatedCapacity: DEFAULT_CAPACITY,
        fillRate,
      });
    }
  }

  return gaps;
}

// Calculate optimal discount: emptier = deeper discount
function calcDiscount(fillRate: number, hoursUntil: number): number {
  let base = 0;
  if (fillRate < 0.2) base = 30;
  else if (fillRate < 0.4) base = 20;
  else base = 10;

  // Urgency bonus: < 12h → extra 5%
  if (hoursUntil < 12) base += 5;
  return Math.min(base, 35); // cap at 35%
}

// Generate flash deal caption via AI
async function generateCaption(slot: SlotGap, discountPct: number, service: string | null): Promise<string> {
  const brandKit = await prisma.brandKit.findFirst();
  const spaName = brandKit?.spaName ?? "Spa";
  const svc = service ?? "dịch vụ spa";

  const prompt = `Viết caption flash deal cho spa theo format:
- Ngắn gọn, hấp dẫn, 100-150 từ
- Giảm ${discountPct}% cho ${svc}
- Chỉ còn ${slot.estimatedCapacity - slot.filledSlots} slot cho ${slot.label}
- Tên spa: ${spaName}
- Có CTA rõ ràng: "Nhắn tin ngay" hoặc "Book ngay"
- Thêm 3-5 emoji phù hợp
- Tạo cảm giác khẩn cấp (limited time)
Chỉ trả về caption, không giải thích.`;

  try {
    return await generateChatCompletion(prompt, "Bạn là copywriter chuyên nghiệp cho spa. Viết caption ngắn gọn, hấp dẫn.");
  } catch {
    return `🔥 FLASH DEAL ${slot.label}!\n\nGiảm ${discountPct}% ${svc} — chỉ còn ${slot.estimatedCapacity - slot.filledSlots} slot!\n\n💬 Nhắn tin ngay để giữ chỗ!`;
  }
}

// Main: detect gaps → create deals → return for approval
export async function runFlashDealDetection(): Promise<{ gaps: SlotGap[]; deals: object[] }> {
  const gaps = await detectSlotGaps();
  if (gaps.length === 0) return { gaps: [], deals: [] };

  // Get most popular service
  const topService = await prisma.bookingRevenue.groupBy({
    by: ["service"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  const service = topService[0]?.service ?? null;

  const deals = [];
  for (const slot of gaps) {
    const discountPct = calcDiscount(slot.fillRate, slot.hoursUntil);
    const caption = await generateCaption(slot, discountPct, service);
    deals.push({ slot, discountPct, service, caption, status: "pending" });
  }

  return { gaps, deals };
}
