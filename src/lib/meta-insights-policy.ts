import { sanitizeMetaPagingUrl } from "./meta-graph-url.ts";

export const META_INSIGHTS_DATE_PRESETS = ["today", "last_7d", "last_30d", "this_month"] as const;

export type MetaInsightsDatePreset = (typeof META_INSIGHTS_DATE_PRESETS)[number];
export type MetaMetric = string | null;

export type MetaInsightsRawRow = {
  campaign_id?: unknown;
  campaign_name?: unknown;
  spend?: unknown;
  reach?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  ctr?: unknown;
  cpm?: unknown;
  cpc?: unknown;
};

type MetaInsightsPage = {
  data?: MetaInsightsRawRow[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
};

const MAX_INSIGHTS_PAGES = 20;
const MAX_INSIGHTS_RECORDS = 1_000;

export const META_INSIGHTS_DATE_PRESET_OPTIONS: ReadonlyArray<{
  label: string;
  value: MetaInsightsDatePreset;
}> = [
  { label: "Hôm nay", value: "today" },
  { label: "7 ngày", value: "last_7d" },
  { label: "30 ngày", value: "last_30d" },
  { label: "Tháng này", value: "this_month" },
];

export function parseMetaInsightsDatePreset(value: unknown): MetaInsightsDatePreset {
  if (typeof value === "string" && META_INSIGHTS_DATE_PRESETS.includes(value as MetaInsightsDatePreset)) {
    return value as MetaInsightsDatePreset;
  }
  throw new Error("Khoảng thời gian Insights không hợp lệ");
}

export function normalizeMetaMetric(value: unknown): MetaMetric {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numeric = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return String(numeric);
}

export async function readMetaInsightsPages(
  initialUrl: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<MetaInsightsRawRow[]> {
  const rows: MetaInsightsRawRow[] = [];
  const visited = new Set<string>();
  let nextUrl: string | null = initialUrl;
  let pageCount = 0;

  while (nextUrl) {
    if (visited.has(nextUrl)) throw new Error("Meta Insights paging bị lặp");
    if (pageCount >= MAX_INSIGHTS_PAGES) throw new Error("Meta Insights vượt giới hạn số trang");
    visited.add(nextUrl);
    pageCount += 1;

    const response = await fetcher(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Meta Insights HTTP ${response.status}`);
    const page = await response.json() as MetaInsightsPage;
    if (page.error) throw new Error(page.error.message || "Meta Insights Graph API lỗi");
    rows.push(...(page.data ?? []));
    if (rows.length > MAX_INSIGHTS_RECORDS) throw new Error("Meta Insights vượt giới hạn bản ghi");
    nextUrl = sanitizeMetaPagingUrl(page.paging?.next);
  }

  return rows;
}
