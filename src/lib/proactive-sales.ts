import { prisma } from "./db";
import { generateContent } from "./claude";
import { replyToFbConversation } from "./facebook";
import { postToZalo } from "./zalo";

type TriggerType = "cold_reactivation" | "birthday" | "vip_loyal" | "post_nps";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  fbId: string | null;
  birthday: string | null;
  segment: string;
  lastContact: Date | null;
  npsScore: number | null;
}

interface Trigger {
  type: TriggerType;
  reason: string;
}

const MAX_PER_RUN = 30;            // tránh spam Zalo/FB
const COOLDOWN_DAYS_DEFAULT = 30;  // 1 customer / 30 ngày max

function pickTrigger(customer: Customer): Trigger | null {
  const now = new Date();
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

const SYSTEM_PROMPT = `Bạn là nhân viên chăm sóc khách hàng của spa Việt Nam. Viết tin nhắn cá nhân hóa cho khách, ngắn (3-5 câu), thân thiện như bạn bè, không quá thương mại. Mục tiêu là tái kết nối, không phải bán hàng ngay.`;

async function generateMessage(customer: Customer, trigger: Trigger): Promise<string> {
  const brand = await prisma.brandKit.findFirst();
  const spaName = brand?.spaName ?? "Spa";

  const typeContext: Record<TriggerType, string> = {
    cold_reactivation: `Khách lâu rồi (${trigger.reason}) chưa quay lại. Nhẹ nhàng hỏi thăm + gợi ý ưu đãi cho khách cũ. Không hối thúc.`,
    birthday: `Sắp đến sinh nhật khách (${trigger.reason}). Chúc mừng + gửi voucher quà sinh nhật (giảm 20% cho lần đặt tiếp theo).`,
    vip_loyal: `Khách VIP — luôn cảm ơn họ vì sự ủng hộ. Gợi ý dịch vụ premium mới hoặc ưu đãi riêng cho VIP.`,
    post_nps: `Khách từng hài lòng cao (${customer.npsScore}⭐). Nhắc lại trải nghiệm tốt + mời quay lại với ưu đãi đặc biệt.`,
  };

  const prompt = `Khách hàng: ${customer.name}
Tình huống: ${typeContext[trigger.type]}
Spa: ${spaName}

Viết tin nhắn cá nhân hóa. KHÔNG thêm "Xin chào [Tên]" hay "Cảm ơn bạn" sáo rỗng — bắt đầu trực tiếp vào nội dung. Không quá 5 câu.`;

  return generateContent(prompt, SYSTEM_PROMPT);
}

export async function runProactiveOutreach(): Promise<{
  candidates: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const settings = await prisma.settings.findFirst();
  // Allow opt-out via settings — check if proactiveSalesEnabled field exists
  // For now, just check automationLevel — only run if not "supervised"
  if (settings?.automationLevel === "supervised") {
    return { candidates: 0, sent: 0, skipped: 0, errors: ["Đang ở supervised mode — skip proactive sales"] };
  }

  const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS_DEFAULT * 86400000);

  // Get customers who haven't received proactive message recently
  const recentlyContacted = await prisma.careMessage.findMany({
    where: {
      type: { startsWith: "proactive_" },
      sentAt: { gte: cooldownDate },
    },
    select: { customerId: true },
  });
  const cooldownSet = new Set(recentlyContacted.map((c) => c.customerId).filter(Boolean) as string[]);

  // Fetch all customers with contact info
  const customers = await prisma.customer.findMany({
    where: {
      OR: [{ fbId: { not: null } }, { phone: { not: null } }],
    },
    select: {
      id: true, name: true, phone: true, fbId: true, birthday: true,
      segment: true, lastContact: true, npsScore: true,
    },
    take: 500,
  });

  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;
  let candidates = 0;

  for (const customer of customers) {
    if (cooldownSet.has(customer.id)) { skipped++; continue; }

    const trigger = pickTrigger(customer);
    if (!trigger) continue;

    candidates++;
    if (sent >= MAX_PER_RUN) { skipped++; continue; }

    try {
      const message = await generateMessage(customer, trigger);
      const channel: "facebook" | "zalo" = customer.fbId ? "facebook" : "zalo";

      if (channel === "facebook" && customer.fbId) {
        await replyToFbConversation(customer.fbId, message);
      } else if (channel === "zalo" && customer.phone) {
        await postToZalo(message, undefined, customer.phone);
      } else {
        continue;
      }

      await prisma.careMessage.create({
        data: {
          customerId: customer.id,
          type: `proactive_${trigger.type}`,
          content: message,
          platform: channel,
          sentAt: new Date(),
          status: "sent",
        },
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastContact: new Date() },
      });

      sent++;
    } catch (e) {
      errors.push(`${customer.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { candidates, sent, skipped, errors };
}
