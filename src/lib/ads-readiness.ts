import "server-only";

import { prisma } from "@/lib/db";
import { adsReadinessBlockReason } from "@/lib/ads-readiness-policy";
import { decryptSecret } from "@/lib/secrets-crypto";

const FB = "https://graph.facebook.com/v21.0";
const REQUIRED_SCOPES = ["ads_read", "ads_management", "pages_read_engagement", "pages_manage_posts"];
const REQUIRED_PAGE_TASKS = ["ADVERTISE"];

type PageCredentials = {
  id: string;
  fbPageId: string;
  accessToken: string;
  adAccountId: string | null;
};

type GraphError = { error?: { message?: string } };

export type AdsReadinessResult = {
  status: "ready" | "blocked";
  checkedAt: Date;
  error: string | null;
  permissions: string[];
  missingPermissions: string[];
  tokenExpiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
  accountStatus: number | null;
  disableReason: number | null;
  currency: string | null;
  timezone: string | null;
};

function normalizeAccountId(value: string) {
  return value.replace(/^act_/, "");
}

function timestampDate(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}

async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${FB}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json() as T & GraphError;
  if (!response.ok || data.error) throw new Error(data.error?.message || `Meta Graph trả lỗi ${response.status}`);
  return data;
}

async function debugToken(accessToken: string) {
  const appAccessToken = process.env.FACEBOOK_APP_ACCESS_TOKEN
    || (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
      ? `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
      : null);
  if (!appAccessToken) throw new Error("Thiếu FACEBOOK_APP_ID/FACEBOOK_APP_SECRET hoặc FACEBOOK_APP_ACCESS_TOKEN");

  const response = await fetch(`${FB}/debug_token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ input_token: accessToken }),
  });
  const body = await response.json() as {
    data?: {
      is_valid?: boolean;
      expires_at?: number;
      data_access_expires_at?: number;
      scopes?: string[];
      granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
    };
    error?: { message?: string };
  };
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta debug_token trả lỗi ${response.status}`);
  if (!body.data?.is_valid) throw new Error("Page Access Token không hợp lệ");
  return body.data;
}

function tokenPermissionsForPage(input: {
  scopes?: string[];
  granularScopes?: Array<{ scope?: string; target_ids?: string[] }>;
  fbPageId: string;
}) {
  const permissions = new Set(input.scopes ?? []);
  for (const granular of input.granularScopes ?? []) {
    if (!granular.scope) continue;
    if (!granular.target_ids?.length || granular.target_ids.includes(input.fbPageId)) {
      permissions.add(granular.scope);
    }
  }
  return [...permissions].sort();
}

async function persistResult(facebookPageId: string, result: AdsReadinessResult) {
  await prisma.facebookPage.update({
    where: { id: facebookPageId },
    data: {
      adsReadinessStatus: result.status,
      adsReadinessError: result.error,
      adsReadinessCheckedAt: result.checkedAt,
      adsTokenExpiresAt: result.tokenExpiresAt,
      adsDataAccessExpiresAt: result.dataAccessExpiresAt,
      adsPermissions: JSON.stringify(result.permissions),
      adsMissingPermissions: JSON.stringify(result.missingPermissions),
      adAccountStatus: result.accountStatus,
      adAccountDisableReason: result.disableReason,
      adAccountCurrency: result.currency,
      adAccountTimezone: result.timezone,
    },
  });
}

export async function probeAdsReadiness(page: PageCredentials): Promise<AdsReadinessResult> {
  const checkedAt = new Date();
  let permissions: string[] = [];
  let tokenExpiresAt: Date | null = null;
  let dataAccessExpiresAt: Date | null = null;
  let accountStatus: number | null = null;
  let disableReason: number | null = null;
  let currency: string | null = null;
  let timezone: string | null = null;

  const pageAccessToken = decryptSecret(page.accessToken);

  try {
    if (!page.adAccountId) throw new Error("Chưa cấu hình Ad Account ID");
    if (!pageAccessToken) throw new Error("Access Token không đọc được — nhập lại trong Cài đặt");
    const token = await debugToken(pageAccessToken);
    tokenExpiresAt = timestampDate(token.expires_at);
    dataAccessExpiresAt = timestampDate(token.data_access_expires_at);
    permissions = tokenPermissionsForPage({
      scopes: token.scopes,
      granularScopes: token.granular_scopes,
      fbPageId: page.fbPageId,
    });
    const missingPermissions = REQUIRED_SCOPES.filter((scope) => !permissions.includes(scope));

    const pageIdentity = await graphGet<{ id?: string; tasks?: string[] }>(page.fbPageId, pageAccessToken, {
      fields: "id,tasks",
    });
    if (pageIdentity.id !== page.fbPageId) throw new Error("Token không thuộc Facebook Page đã cấu hình");
    const missingTasks = REQUIRED_PAGE_TASKS.filter((task) => !(pageIdentity.tasks ?? []).includes(task));

    const actId = `act_${normalizeAccountId(page.adAccountId)}`;
    const account = await graphGet<{
      account_id?: string;
      account_status?: number;
      disable_reason?: number;
      currency?: string;
      timezone_name?: string;
      promote_pages?: { data?: Array<{ id?: string }> };
    }>(actId, pageAccessToken, {
      fields: "account_id,account_status,disable_reason,currency,timezone_name,promote_pages.limit(100){id}",
    });
    if (normalizeAccountId(account.account_id ?? "") !== normalizeAccountId(page.adAccountId)) {
      throw new Error("Ad Account trả về không khớp cấu hình");
    }
    accountStatus = account.account_status ?? null;
    disableReason = account.disable_reason ?? null;
    currency = account.currency ?? null;
    timezone = account.timezone_name ?? null;

    const errors: string[] = [];
    if (missingPermissions.length) errors.push(`Thiếu quyền: ${missingPermissions.join(", ")}`);
    if (missingTasks.length) errors.push(`Page thiếu task: ${missingTasks.join(", ")}`);
    if (!(account.promote_pages?.data ?? []).some((item) => item.id === page.fbPageId)) {
      errors.push("Facebook Page chưa được liên kết để quảng cáo trên Ad Account");
    }
    if (accountStatus !== 1) errors.push(`Ad Account không hoạt động (status ${accountStatus ?? "unknown"})`);
    if (disableReason && disableReason !== 0) errors.push(`Ad Account bị vô hiệu hóa (reason ${disableReason})`);
    if (currency !== "VND") errors.push(`Chỉ cho phép Ad Account VND; hiện tại ${currency ?? "unknown"}`);
    if (tokenExpiresAt && tokenExpiresAt <= checkedAt) errors.push("Page Access Token đã hết hạn");
    if (dataAccessExpiresAt && dataAccessExpiresAt <= checkedAt) errors.push("Quyền truy cập dữ liệu đã hết hạn");

    const result: AdsReadinessResult = {
      status: errors.length ? "blocked" : "ready",
      checkedAt,
      error: errors.length ? errors.join("; ") : null,
      permissions,
      missingPermissions,
      tokenExpiresAt,
      dataAccessExpiresAt,
      accountStatus,
      disableReason,
      currency,
      timezone,
    };
    await persistResult(page.id, result);
    return result;
  } catch (error) {
    const result: AdsReadinessResult = {
      status: "blocked",
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
      permissions,
      missingPermissions: REQUIRED_SCOPES.filter((scope) => !permissions.includes(scope)),
      tokenExpiresAt,
      dataAccessExpiresAt,
      accountStatus,
      disableReason,
      currency,
      timezone,
    };
    await persistResult(page.id, result);
    return result;
  }
}

export async function assertAdsReadiness(facebookPageId?: string, expectedAdAccountId?: string) {
  if (!facebookPageId) throw new Error("Thao tác quảng cáo yêu cầu Facebook Page cụ thể");
  const page = await prisma.facebookPage.findUnique({
    where: { id: facebookPageId },
    select: {
      adAccountId: true,
      adsReadinessStatus: true,
      adsReadinessError: true,
      adsReadinessCheckedAt: true,
      adAccountStatus: true,
      adAccountCurrency: true,
    },
  });
  if (!page?.adAccountId) throw new Error("Chưa cấu hình Ad Account ID");
  if (expectedAdAccountId && normalizeAccountId(page.adAccountId) !== normalizeAccountId(expectedAdAccountId)) {
    throw new Error("Ad Account trong yêu cầu không khớp Facebook Page");
  }
  const reason = adsReadinessBlockReason(page);
  if (reason) throw new Error(reason);
  return page;
}
