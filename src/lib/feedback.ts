import { prisma } from "./db";
import { replyToFbConversation } from "./facebook";
import { postToZalo } from "./zalo";

export const NPS_MESSAGE =
  "Cảm ơn bạn đã trải nghiệm dịch vụ của chúng tôi! " +
  "Bạn hài lòng với trải nghiệm hôm nay không? Hãy cho chúng tôi biết bằng cách trả lời từ 1-5 ⭐\n" +
  "(1 = Chưa hài lòng, 5 = Rất hài lòng)";

export async function sendNpsSurvey(customerId: string, channel?: "zalo" | "facebook") {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return { ok: false as const, status: 404, error: "Không tìm thấy khách hàng" };
  }

  const platform = channel ?? (customer.fbId ? "facebook" : "zalo");

  if (platform === "zalo" && customer.phone) {
    await postToZalo(NPS_MESSAGE, undefined, customer.phone);
  } else if (platform === "facebook" && customer.fbId) {
    await replyToFbConversation(customer.fbId, NPS_MESSAGE);
  } else {
    return { ok: false as const, status: 400, error: "Không có thông tin liên lạc (phone/fbId) để gửi NPS" };
  }

  await prisma.careMessage.create({
    data: {
      customerId,
      type: "nps_survey",
      content: NPS_MESSAGE,
      platform,
      sentAt: new Date(),
      status: "sent",
    },
  });

  return { ok: true as const, platform };
}

export async function recordNpsScore(customerId: string, score: number) {
  if (!customerId || score < 1 || score > 5) {
    return { ok: false as const, status: 400, error: "customerId và score (1-5) là bắt buộc" };
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { npsScore: score, npsAt: new Date() },
  });

  await prisma.customerNote.create({
    data: { customerId, content: `NPS: ${score}/5`, type: "nps" },
  });

  return { ok: true as const };
}

export async function batchSendNps(hoursAfter = 2) {
  const since = new Date(Date.now() - hoursAfter * 3600000);

  const recentCare = await prisma.careMessage.findMany({
    where: { type: "nps_survey", sentAt: { gte: new Date(Date.now() - 86400000) } },
    select: { customerId: true },
  });
  const alreadySent = new Set(recentCare.map((c) => c.customerId).filter(Boolean) as string[]);

  const appointments = await prisma.appointmentRequest.findMany({
    where: { status: "confirmed", updatedAt: { gte: since }, customerId: { not: null } },
    include: { customer: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appt of appointments) {
    if (!appt.customerId || alreadySent.has(appt.customerId)) {
      skipped++;
      continue;
    }

    const customer = appt.customer;
    if (!customer) {
      skipped++;
      continue;
    }

    const platform = customer.fbId ? "facebook" : customer.phone ? "zalo" : null;
    if (!platform) {
      skipped++;
      continue;
    }

    try {
      if (platform === "zalo" && customer.phone) {
        await postToZalo(NPS_MESSAGE, undefined, customer.phone);
      } else if (platform === "facebook" && customer.fbId) {
        await replyToFbConversation(customer.fbId, NPS_MESSAGE);
      }

      await prisma.careMessage.create({
        data: {
          customerId: appt.customerId,
          type: "nps_survey",
          content: NPS_MESSAGE,
          platform,
          sentAt: new Date(),
          status: "sent",
        },
      });
      sent++;
      alreadySent.add(appt.customerId);
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed, checked: appointments.length };
}
