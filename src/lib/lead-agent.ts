import { prisma } from "./db";
import { generateContent } from "./claude";
import { replyToFbConversation } from "./facebook";
import { postToZalo } from "./zalo";
import { pushLeadToSpa, getSpaBookingLink } from "./spa-client";

const STEP_QUESTIONS = [
  "Xin chào! Bạn tên gì để mình tiện xưng hô ạ?",
  "Bạn đang quan tâm đến dịch vụ nào của spa ạ?",
  "Bạn muốn đặt lịch vào khoảng thời gian nào? (buổi sáng/chiều, ngày trong tuần...)",
];

async function extractInfo(field: string, text: string): Promise<string | null> {
  try {
    const result = await generateContent(
      `Từ tin nhắn tiếng Việt sau: "${text}"\nTrích xuất ${field}. Chỉ trả về giá trị, không giải thích. Nếu không tìm thấy trả về NONE.`,
      "Bạn là AI trích xuất thông tin từ tin nhắn tiếng Việt. Trả lời ngắn gọn, chỉ giá trị cần thiết."
    );
    const trimmed = result.trim();
    return trimmed === "NONE" || !trimmed ? null : trimmed;
  } catch {
    return null;
  }
}

export async function getOrCreateConversation(
  senderId: string,
  facebookPageId?: string | null,
  channel: "facebook" | "zalo" = "facebook"
) {
  const existing = await prisma.leadConversation.findFirst({
    where: { senderId, facebookPageId: facebookPageId ?? null, isComplete: false },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const existingLead = await prisma.lead.findFirst({ where: { channelId: senderId, channelType: channel } });
  const lead = existingLead ?? await prisma.lead.create({
    data: {
      name: channel === "zalo" ? "Khách Zalo" : "Khách Facebook",
      source: channel,
      channelType: channel,
      channelId: senderId,
    },
  });

  return prisma.leadConversation.create({
    data: { leadId: lead.id, senderId, facebookPageId: facebookPageId ?? null, step: 1 },
  });
}

export async function processIncomingMessage(
  convId: string,
  messageText: string
): Promise<{ replyText: string; isComplete: boolean }> {
  const conv = await prisma.leadConversation.findUnique({ where: { id: convId } });
  if (!conv || conv.isComplete) return { replyText: "", isComplete: true };

  let replyText = "";
  let nextStep = conv.step;
  const updateData: Record<string, unknown> = {};

  if (conv.step === 0) {
    // Send first question
    replyText = STEP_QUESTIONS[0];
    nextStep = 1;
  } else if (conv.step === 1) {
    // Extract name from reply
    const name = await extractInfo("tên người", messageText);
    if (name) {
      updateData.collectedName = name;
      // Update lead name
      await prisma.lead.updateMany({ where: { channelId: conv.senderId }, data: { name } });
      replyText = `Xin chào ${name}! ${STEP_QUESTIONS[1]}`;
      nextStep = 2;
    } else {
      replyText = "Mình chưa hiểu tên bạn ạ. Bạn có thể cho mình biết tên không?";
    }
  } else if (conv.step === 2) {
    // Extract service
    const service = await extractInfo("tên dịch vụ spa/làm đẹp", messageText);
    if (service) {
      updateData.collectedService = service;
      await prisma.lead.updateMany({ where: { channelId: conv.senderId }, data: { service } });
      const name = conv.collectedName ?? "bạn";
      replyText = `${name} muốn ${service} — tuyệt! ${STEP_QUESTIONS[2]}`;
      nextStep = 3;
    } else {
      replyText = "Spa có nhiều dịch vụ như facial, massage, waxing, nail... Bạn quan tâm đến dịch vụ nào ạ?";
    }
  } else if (conv.step === 3) {
    // Extract time preference
    const timePreference = await extractInfo("thời gian/lịch hẹn", messageText);
    updateData.isComplete = true;
    nextStep = 4;
    // Score the lead
    await prisma.lead.updateMany({
      where: { channelId: conv.senderId },
      data: { stage: "hot", score: 80, lastAction: `Qualification hoàn tất: ${conv.collectedService ?? "dịch vụ spa"}`, note: timePreference ? `Muốn đặt lịch: ${timePreference}` : undefined },
    });
    replyText = `Cảm ơn ${conv.collectedName ?? "bạn"}! Mình đã ghi nhận thông tin. Nhân viên sẽ liên hệ xác nhận lịch cho bạn sớm nhé! 😊`;
  }

  await prisma.leadConversation.update({
    where: { id: convId },
    data: { step: nextStep, ...updateData },
  });

  return { replyText, isComplete: nextStep >= 4 };
}

export async function executeHandoff(
  convId: string,
  mode: string,
  recipientZaloId?: string | null
): Promise<void> {
  const conv = await prisma.leadConversation.findUnique({ where: { id: convId }, include: { lead: true } });
  if (!conv) return;

  const lead = conv.lead;
  const handoffAt = new Date();

  const isZalo = lead.channelType === "zalo";

  const replyToLead = async (text: string) => {
    if (isZalo) {
      await postToZalo(text, undefined, conv.senderId);
    } else {
      await replyToFbConversation(conv.senderId, text, conv.facebookPageId ?? undefined);
    }
  };

  if (mode === "link") {
    const link = await getSpaBookingLink(conv.collectedService);
    await replyToLead(`Bạn có thể đặt lịch trực tiếp tại đây nhé: ${link}`);
  } else if (mode === "api") {
    try {
      const { bookingId } = await pushLeadToSpa({
        name: lead.name,
        phone: lead.phone,
        service: conv.collectedService,
        source: isZalo ? "zalo_bot" : "facebook_bot",
        note: lead.note,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { spaBookingId: bookingId } });
      await replyToLead(`Mình đã đặt lịch cho bạn! Nhân viên sẽ xác nhận qua tin nhắn sớm nhé.`);
    } catch {
      await notifyStaff(lead.name, conv.collectedService, conv.senderId, lead.channelType ?? "facebook", recipientZaloId);
    }
  } else {
    await notifyStaff(lead.name, conv.collectedService, conv.senderId, lead.channelType ?? "facebook", recipientZaloId);
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { handoffAt, handoffMode: mode } });
}

async function notifyStaff(
  name: string,
  service: string | null,
  senderId: string,
  channel: string,
  recipientZaloId?: string | null
) {
  if (!recipientZaloId) return;
  const channelLabel = channel === "zalo" ? "Zalo" : "Facebook";
  const msg = `🔔 Lead mới cần follow-up!\n👤 ${name}\n💆 Dịch vụ: ${service ?? "chưa rõ"}\n📱 ${channelLabel} ID: ${senderId}\n\nVui lòng liên hệ khách xác nhận lịch.`;
  await postToZalo(msg, undefined, recipientZaloId);
}
