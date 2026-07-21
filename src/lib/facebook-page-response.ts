function parsedList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function safeFacebookPage(page: {
  id: string;
  fbPageId: string;
  pageName: string;
  accessToken: string;
  isActive: boolean;
  adAccountId: string | null;
  createdAt: Date;
  adsReadinessStatus: string;
  adsReadinessError: string | null;
  adsReadinessCheckedAt: Date | null;
  adsTokenExpiresAt: Date | null;
  adsDataAccessExpiresAt: Date | null;
  adsPermissions: string;
  adsMissingPermissions: string;
  adAccountStatus: number | null;
  adAccountDisableReason: number | null;
  adAccountCurrency: string | null;
  adAccountTimezone: string | null;
}) {
  return {
    id: page.id,
    fbPageId: page.fbPageId,
    pageName: page.pageName,
    isActive: page.isActive,
    adAccountId: page.adAccountId,
    createdAt: page.createdAt,
    accessTokenHint: "••••••••" + page.accessToken.slice(-4),
    adsReadiness: {
      status: page.adsReadinessStatus,
      error: page.adsReadinessError,
      checkedAt: page.adsReadinessCheckedAt,
      tokenExpiresAt: page.adsTokenExpiresAt,
      dataAccessExpiresAt: page.adsDataAccessExpiresAt,
      permissions: parsedList(page.adsPermissions),
      missingPermissions: parsedList(page.adsMissingPermissions),
      accountStatus: page.adAccountStatus,
      disableReason: page.adAccountDisableReason,
      currency: page.adAccountCurrency,
      timezone: page.adAccountTimezone,
    },
  };
}
