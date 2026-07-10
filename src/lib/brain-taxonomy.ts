export const BRAIN_DOMAINS = [
  "sales",
  "content",
  "ads",
  "intelligence",
  "customer",
  "operation",
  "brand",
] as const;

export type BrainDomain = typeof BRAIN_DOMAINS[number];

export type PermissionLevel = "suggest" | "draft" | "supervised" | "auto";
export type RiskLevel = "low" | "medium" | "high";

export interface DomainMeta {
  domain: BrainDomain;
  label: string;
  description: string;
  categories: string[];
  color: string;
}

export const BRAIN_TAXONOMY: Record<BrainDomain, DomainMeta> = {
  sales: {
    domain: "sales",
    label: "Sales Brain",
    description: "Lead, follow-up, chốt lịch, tái kích hoạt khách cũ.",
    categories: ["lead_followup", "booking_close", "reactivation", "handoff", "nurture"],
    color: "var(--rose)",
  },
  content: {
    domain: "content",
    label: "Content Brain",
    description: "Caption, lịch đăng, khuyến mãi, story, ý tưởng hình ảnh.",
    categories: ["caption", "promotion", "calendar", "image_prompt", "repurpose", "story"],
    color: "var(--accent)",
  },
  ads: {
    domain: "ads",
    label: "Ads Brain",
    description: "Creative, ngân sách, scale/pause, campaign insight.",
    categories: ["creative", "budget", "scale_pause", "audience", "campaign_review"],
    color: "var(--blue)",
  },
  intelligence: {
    domain: "intelligence",
    label: "Intelligence Brain",
    description: "Đối thủ, trend, social listening, tín hiệu thị trường.",
    categories: ["competitor", "trend", "listening", "market_signal", "review_scan"],
    color: "var(--amber)",
  },
  customer: {
    domain: "customer",
    label: "Customer Brain",
    description: "Inbox, comment, khiếu nại, chăm sóc khách hàng.",
    categories: ["inbox_reply", "comment_reply", "complaint_handling", "care_message", "faq"],
    color: "var(--success)",
  },
  operation: {
    domain: "operation",
    label: "Operation Brain",
    description: "Approval, báo cáo, backup, nhắc việc và workflow nội bộ.",
    categories: ["approval", "reporting", "backup", "task_routing", "workflow"],
    color: "var(--premium)",
  },
  brand: {
    domain: "brand",
    label: "Brand Brain",
    description: "Văn phong, FAQ, chính sách, dịch vụ, brand kit.",
    categories: ["voice", "policy", "faq", "service_knowledge", "brand_kit"],
    color: "var(--text-secondary)",
  },
};

export const DOMAIN_LABELS = Object.fromEntries(
  Object.entries(BRAIN_TAXONOMY).map(([domain, meta]) => [domain, meta.label]),
) as Record<BrainDomain, string>;

export function isBrainDomain(value: string): value is BrainDomain {
  return (BRAIN_DOMAINS as readonly string[]).includes(value);
}

export function normalizeDomain(value: string | undefined): BrainDomain {
  return value && isBrainDomain(value) ? value : "operation";
}

export function normalizeCategory(domain: BrainDomain, category: string | undefined) {
  const allowed = BRAIN_TAXONOMY[domain].categories;
  return category && allowed.includes(category) ? category : allowed[0];
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
