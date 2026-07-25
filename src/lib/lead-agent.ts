import { prisma } from "./db";
import { generateContent } from "./claude";
import { replyToFbConversation } from "./facebook";
import { postToZalo } from "./zalo";
import { getSpaBookingLink } from "./spa-client";

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

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function getOrCreateConversation(
  senderId: string,
  facebookPageId?: string | null,
  channel: "facebook" | "zalo" = "facebook",
  attribution?: { fromPostId?: string; fromCampaignId?: string; fromAdId?: string }
) {
  if (channel === "facebook" && !facebookPageId) {
    throw new Error("Messenger conversation yêu cầu Facebook Page nội bộ");
  }

  const pageId = facebookPageId ?? null;
  const where = { senderId, facebookPageId: pageId, isComplete: false };
  const existing = await prisma.leadConversation.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  try {
    return await prisma.$transaction(async (tx) => {
      const previousConversation = await tx.leadConversation.findFirst({
        where: { senderId, facebookPageId: pageId },
        orderBy: { createdAt: "desc" },
        select: { leadId: true },
      });
      const existingLead = previousConversation
        ? await tx.lead.findUnique({ where: { id: previousConversation.leadId } })
        : channel === "zalo"
          ? await tx.lead.findFirst({ where: { channelId: senderId, channelType: channel } })
          : null;
      const lead = existingLead ?? await tx.lead.create({
        data: {
          name: channel === "zalo" ? "Khách Zalo" : "Khách Facebook",
          source: channel,
          channelType: channel,
          channelId: senderId,
          fromPostId: attribution?.fromPostId ?? null,
          fromCampaignId: attribution?.fromCampaignId ?? null,
          fromAdId: attribution?.fromAdId ?? null,
        },
      });

      return tx.leadConversation.create({
        data: { leadId: lead.id, senderId, facebookPageId: pageId, step: 1 },
      });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error) || !pageId) throw error;
    return prisma.leadConversation.findFirstOrThrow({
      where,
      orderBy: { createdAt: "desc" },
    });
  }
}

export async function processIncomingMessage(
  convId: string,
  messageText: string
): Promise<{ replyText: string; isComplete: boolean }> {
  const conv = await prisma.leadConversation.findUnique({ where: { id: convId } });
  if (!conv || conv.isComplete) return { replyText: "", isComplete: false };

  let replyText = "";
  let nextStep = conv.step;
  let conversationData: Record<string, unknown> = {};
  let leadData: Record<string, unknown> | null = null;

  if (conv.step === 0) {
    replyText = STEP_QUESTIONS[0];
    nextStep = 1;
  } else if (conv.step === 1) {
    const name = await extractInfo("tên người", messageText);
    if (name) {
      conversationData = { collectedName: name };
      leadData = { name };
      replyText = `Xin chào ${name}! ${STEP_QUESTIONS[1]}`;
      nextStep = 2;
    } else {
      replyText = "Mình chưa hiểu tên bạn ạ. Bạn có thể cho mình biết tên không?";
    }
  } else if (conv.step === 2) {
    const service = await extractInfo("tên dịch vụ spa/làm đẹp", messageText);
    if (service) {
      conversationData = { collectedService: service };
      leadData = { service };
      const name = conv.collectedName ?? "bạn";
      replyText = `${name} muốn ${service} — tuyệt! ${STEP_QUESTIONS[2]}`;
      nextStep = 3;
    } else {
      replyText = "Spa có nhiều dịch vụ như facial, massage, waxing, nail... Bạn quan tâm đến dịch vụ nào ạ?";
    }
  } else if (conv.step === 3) {
    const timePreference = await extractInfo("thời gian/lịch hẹn", messageText);
    conversationData = { isComplete: true };
    leadData = {
      stage: "hot",
      score: 80,
      lastAction: `Qualification hoàn tất: ${conv.collectedService ?? "dịch vụ spa"}`,
      note: timePreference ? `Muốn đặt lịch: ${timePreference}` : undefined,
    };
    nextStep = 4;
    replyText = `Cảm ơn ${conv.collectedName ?? "bạn"}! Mình đã ghi nhận thông tin. Nhân viên sẽ liên hệ xác nhận lịch cho bạn sớm nhé! 😊`;
  }

  const advanced = await prisma.$transaction(async (tx) => {
    const claimed = await tx.leadConversation.updateMany({
      where: { id: conv.id, version: conv.version, isComplete: false },
      data: { step: nextStep, version: { increment: 1 }, ...conversationData },
    });
    if (claimed.count !== 1) return false;
    if (leadData) await tx.lead.update({ where: { id: conv.leadId }, data: leadData });
    return true;
  });

  return advanced
    ? { replyText, isComplete: nextStep >= 4 }
    : { replyText: "", isComplete: false };
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
  } else {
    await notifyStaff(lead.name, conv.collectedService, conv.senderId, lead.channelType ?? "facebook", recipientZaloId);
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { handoffAt, handoffMode: mode === "api" ? "staff" : mode },
  });
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
