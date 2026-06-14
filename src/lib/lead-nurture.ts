import { prisma } from "./db";
import { postToZalo } from "./zalo";
import { replyToFbConversation } from "./facebook";

// Days to wait between nurture steps
const STEP_DELAYS = [1, 3, 7];

function buildMessage(step: number, name: string, service: string | null): string {
  const svc = service ?? "dịch vụ spa";
  const n = name && name !== "Khách Facebook" && name !== "Khách Zalo" ? name : "bạn";
  if (step === 0) {
    return `Xin chào ${n}! Spa muốn hỏi thăm xem bạn có muốn đặt lịch ${svc} không ạ? Mình sẵn sàng hỗ trợ bạn ngay 😊`;
  }
  if (step === 1) {
    return `Chào ${n}! Spa đang có ưu đãi đặc biệt cho dịch vụ ${svc} tuần này. Đặt lịch ngay để không bỏ lỡ nhé 🌟`;
  }
  return `Chào ${n}! Đây là tin nhắn cuối từ spa. Khi nào bạn cần ${svc} thì cứ nhắn mình, spa luôn sẵn sàng hỗ trợ 💜`;
}

export async function runLeadNurture(): Promise<{ sent: number; skipped: number; errors: number }> {
  const now = new Date();
  let sent = 0, skipped = 0, errors = 0;

  const leads = await prisma.lead.findMany({
    where: {
      channelId: { not: null },
      channelType: { not: null },
      handoffAt: null,
      nurtureStep: { lt: 3 },
    },
  });

  for (const lead of leads) {
    const delay = STEP_DELAYS[lead.nurtureStep] ?? 7;
    const threshold = new Date(now.getTime() - delay * 24 * 60 * 60 * 1000);
    const lastContact = lead.nurtureSentAt ?? lead.createdAt;

    if (lastContact > threshold) { skipped++; continue; }

    const message = buildMessage(lead.nurtureStep, lead.name, lead.service ?? null);

    try {
      if (lead.channelType === "zalo" && lead.channelId) {
        await postToZalo(message, undefined, lead.channelId);
      } else if (lead.channelType === "facebook" && lead.channelId) {
        await replyToFbConversation(lead.channelId, message);
      } else {
        skipped++; continue;
      }

      const nextStep = lead.nurtureStep + 1;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nurtureStep: nextStep,
          nurtureSentAt: now,
          ...(nextStep >= 3 ? { stage: "cold", lastAction: "Nurture hoàn tất — không phản hồi" } : {}),
        },
      });
      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, skipped, errors };
}
