import "server-only";

import { prisma } from "@/lib/db";

export interface CustomerSummaryData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  fbName: string | null;
  segment: string;
  leadScore: number;
  note: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStatsData {
  total: number;
  new: number;
  regular: number;
  vip: number;
}

export interface CustomerDetailData extends CustomerSummaryData {
  notes: { id: string; content: string; type: string; createdAt: string }[];
  appointments: { id: string; service: string | null; preferredAt: string | null; status: string; createdAt: string }[];
  careMessages: { id: string; type: string; content: string; status: string; sentAt: string | null; createdAt: string }[];
  messages: { id: string; message: string; reply: string | null; isAutoReply: boolean; createdAt: string }[];
}

export interface LeadData {
  id: string;
  name: string;
  phone: string | null;
  source: string;
  score: number;
  stage: string;
  service: string | null;
  lastAction: string | null;
  note: string | null;
  facebookPageId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStatsData {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  closed: number;
}

export interface CareMessageData {
  id: string;
  type: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string | null; segment: string } | null;
}

export async function getCustomerWorkspaceData(segment?: string) {
  const where = segment ? { segment } : {};
  const [customers, total, newCount, regular, vip] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        birthday: true,
        fbName: true,
        segment: true,
        leadScore: true,
        note: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { segment: "new" } }),
    prisma.customer.count({ where: { segment: "regular" } }),
    prisma.customer.count({ where: { segment: "vip" } }),
  ]);

  return {
    customers: customers.map(serializeCustomer),
    stats: { total, new: newCount, regular, vip } satisfies CustomerStatsData,
  };
}

export async function getCustomerDetail(id: string): Promise<CustomerDetailData | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthday: true,
      fbName: true,
      segment: true,
      leadScore: true,
      note: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      notes: { orderBy: { createdAt: "desc" }, select: { id: true, content: true, type: true, createdAt: true } },
      appointments: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, service: true, preferredAt: true, status: true, createdAt: true } },
      careMessages: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, content: true, status: true, sentAt: true, createdAt: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, message: true, reply: true, isAutoReply: true, createdAt: true } },
    },
  });
  if (!customer) return null;

  return {
    ...serializeCustomer(customer),
    notes: customer.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
    appointments: customer.appointments.map((appointment) => ({ ...appointment, createdAt: appointment.createdAt.toISOString() })),
    careMessages: customer.careMessages.map((message) => ({
      ...message,
      sentAt: message.sentAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
    messages: customer.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() })),
  };
}

export async function getScopedLeads(pageIds: string[], stage?: string) {
  const ownership = { conversations: { some: { facebookPageId: { in: pageIds } } } };
  const where = { ...ownership, ...(stage ? { stage } : {}) };
  const [leads, total, hot, warm, cold, closed] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        source: true,
        score: true,
        stage: true,
        service: true,
        lastAction: true,
        note: true,
        conversations: {
          where: { facebookPageId: { in: pageIds } },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { facebookPageId: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.lead.count({ where: ownership }),
    prisma.lead.count({ where: { ...ownership, stage: "hot" } }),
    prisma.lead.count({ where: { ...ownership, stage: "warm" } }),
    prisma.lead.count({ where: { ...ownership, stage: "cold" } }),
    prisma.lead.count({ where: { ...ownership, stage: "closed" } }),
  ]);

  return {
    leads: leads.map(({ conversations, ...lead }) => ({
      ...lead,
      facebookPageId: conversations[0].facebookPageId!,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    })),
    stats: { total, hot, warm, cold, closed } satisfies LeadStatsData,
  };
}

export async function getCareWorkspaceData(status?: string) {
  const where = status ? { status } : {};
  const [messages, pending, sent, total, customers] = await Promise.all([
    prisma.careMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        content: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true, segment: true } },
      },
    }),
    prisma.careMessage.count({ where: { status: "pending" } }),
    prisma.careMessage.count({ where: { status: "sent" } }),
    prisma.careMessage.count(),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, birthday: true, segment: true },
    }),
  ]);

  return {
    messages: messages.map((message) => ({
      ...message,
      scheduledAt: message.scheduledAt?.toISOString() ?? null,
      sentAt: message.sentAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
    stats: { pending, sent, total },
    customers,
  };
}

function serializeCustomer(customer: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  fbName: string | null;
  segment: string;
  leadScore: number;
  note: string | null;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerSummaryData {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}
