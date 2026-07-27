import { prisma } from "./db";
import { postToZalo } from "./zalo";
import { replyToFbConversation } from "./facebook";
import { buildMessage, isNurtureDue } from "./lead-nurture-policy";

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
    if (!isNurtureDue(lead, now)) { skipped++; continue; }

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
