import { prisma } from "@/lib/db";
import { generateChatCompletion } from "@/lib/openai";
import { calcDiscount, computeSlotGaps, type SlotGap } from "@/lib/flash-deal-policy";

export type { SlotGap } from "@/lib/flash-deal-policy";

export interface FlashDeal {
  id: string;
  slotDate: string;
  discountPct: number;
  service: string | null;
  caption: string;
  status: "pending" | "approved" | "posted" | "expired";
  createdAt: Date;
}

// Find gaps: days in the next 48h with fill rate < 60%
export async function detectSlotGaps(): Promise<SlotGap[]> {
  const now = new Date();

  // Count confirmed/pending appointments per day in next 48h
  const appts = await prisma.appointmentRequest.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      preferredAt: { not: null },
    },
  });

  return computeSlotGaps(appts, now);
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
