import "server-only";

import { getInboxMessages } from "@/lib/customer-inbox";
import { getCareWorkspaceData, getCustomerWorkspaceData, getScopedLeads } from "@/lib/customer-workspaces";

export type CustomerOverviewAvailability = "available" | "partial" | "unavailable";

interface CustomerOverviewProvenance {
  availability: CustomerOverviewAvailability;
  source: string;
  scope: "current_page" | "authorized_pages" | "account";
  asOf: string;
  warning: string | null;
}

export interface CustomerOverviewData {
  asOf: string;
  inbox: CustomerOverviewProvenance & {
    records: Awaited<ReturnType<typeof getInboxMessages>>;
    handled: number | null;
    savedReplies: number | null;
  };
  sales: CustomerOverviewProvenance & {
    leads: Awaited<ReturnType<typeof getScopedLeads>>["leads"];
    stats: Awaited<ReturnType<typeof getScopedLeads>>["stats"] | null;
  };
  crm: CustomerOverviewProvenance & {
    customers: Awaited<ReturnType<typeof getCustomerWorkspaceData>>["customers"];
    stats: Awaited<ReturnType<typeof getCustomerWorkspaceData>>["stats"];
  };
  care: CustomerOverviewProvenance & {
    messages: Awaited<ReturnType<typeof getCareWorkspaceData>>["messages"];
    stats: Awaited<ReturnType<typeof getCareWorkspaceData>>["stats"];
  };
}

export async function getCustomerOverview({
  pageIds,
  currentPageId,
}: {
  pageIds: string[];
  currentPageId?: string;
}): Promise<CustomerOverviewData> {
  const asOf = new Date().toISOString();
  const [messages, leads, crm, care] = await Promise.all([
    currentPageId ? getInboxMessages(currentPageId, 8) : Promise.resolve(null),
    pageIds.length ? getScopedLeads(pageIds) : Promise.resolve(null),
    getCustomerWorkspaceData(undefined, 6),
    getCareWorkspaceData(undefined, { take: 6, includeCustomers: false }),
  ]);

  return {
    asOf,
    inbox: {
      availability: messages ? "available" : "unavailable",
      source: "InboxMessage persisted",
      scope: "current_page",
      asOf,
      warning: messages
        ? "Mỗi bản ghi là một tin nhắn phẳng; isRead chỉ là trạng thái xử lý legacy, không phải delivery receipt."
        : "Chọn một Facebook Page để xem message records; dashboard không gộp nhiều Page thành unified inbox.",
      records: messages ?? [],
      handled: messages ? messages.filter((message) => message.isRead).length : null,
      savedReplies: messages ? messages.filter((message) => message.reply).length : null,
    },
    sales: {
      availability: leads ? "available" : "unavailable",
      source: "Lead + Conversation persisted",
      scope: "authorized_pages",
      asOf,
      warning: leads
        ? "Chỉ gồm lead có conversation gắn với Facebook Page trong phạm vi được cấp quyền."
        : "Chưa có Facebook Page được cấp quyền để tổng hợp lead Page-safe.",
      leads: leads?.leads.slice(0, 6) ?? [],
      stats: leads?.stats ?? null,
    },
    crm: {
      availability: "available",
      source: "Customer persisted",
      scope: "account",
      asOf,
      warning: "Customer chưa lưu Facebook Page nguồn nên CRM chỉ được mô tả ở cấp tài khoản.",
      customers: crm.customers.slice(0, 6),
      stats: crm.stats,
    },
    care: {
      availability: "available",
      source: "CareMessage persisted",
      scope: "account",
      asOf,
      warning: "Trạng thái sent chỉ là đã ghi nhận gửi, không chứng minh external delivery.",
      messages: care.messages.slice(0, 6),
      stats: care.stats,
    },
  };
}
