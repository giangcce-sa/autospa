import "server-only";

import { prisma } from "@/lib/db";
import { AccessError } from "@/lib/page-access";

export interface InboxMessageData {
  id: string;
  senderName: string;
  senderId: string;
  message: string;
  reply: string | null;
  isAutoReply: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface AppointmentRequestData {
  id: string;
  name: string;
  phone: string | null;
  service: string | null;
  preferredAt: string | null;
  note: string | null;
  status: string;
  source: string;
  createdAt: string;
}

export interface MessageRuleData {
  id: string;
  trigger: string;
  reply: string;
  matchMode: string;
  priority: number;
  channel: string;
  isActive: boolean;
  createdAt: string;
}

export async function getInboxMessages(facebookPageId: string, take = 50) {
  const messages = await prisma.inboxMessage.findMany({
    where: { facebookPageId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      senderName: true,
      senderId: true,
      message: true,
      reply: true,
      isAutoReply: true,
      isRead: true,
      createdAt: true,
    },
  });
  return messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }));
}

export async function getInboxMessage(facebookPageId: string, id: string) {
  const message = await prisma.inboxMessage.findUnique({
    where: { id },
    select: {
      id: true,
      facebookPageId: true,
      senderName: true,
      senderId: true,
      message: true,
      reply: true,
      isAutoReply: true,
      isRead: true,
      createdAt: true,
    },
  });
  if (!message) return null;
  if (message.facebookPageId !== facebookPageId) throw new AccessError("Tin nhắn thuộc Facebook Page khác", 403);
  return {
    id: message.id,
    senderName: message.senderName,
    senderId: message.senderId,
    message: message.message,
    reply: message.reply,
    isAutoReply: message.isAutoReply,
    isRead: message.isRead,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getAppointmentRequests(take = 50) {
  const appointments = await prisma.appointmentRequest.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      phone: true,
      service: true,
      preferredAt: true,
      note: true,
      status: true,
      source: true,
      createdAt: true,
    },
  });
  return appointments.map((appointment) => ({ ...appointment, createdAt: appointment.createdAt.toISOString() }));
}

export async function getMessageRules() {
  const rules = await prisma.messageRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return rules.map((rule) => ({ ...rule, createdAt: rule.createdAt.toISOString() }));
}
