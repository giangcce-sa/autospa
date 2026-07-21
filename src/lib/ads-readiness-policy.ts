export const ADS_READINESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type AdsReadinessSnapshot = {
  adsReadinessStatus: string;
  adsReadinessError: string | null;
  adsReadinessCheckedAt: Date | null;
  adAccountStatus: number | null;
  adAccountCurrency: string | null;
};

export function adsReadinessBlockReason(page: AdsReadinessSnapshot, now = new Date()) {
  if (page.adsReadinessStatus !== "ready") {
    return page.adsReadinessError || "Ad Account chưa vượt qua readiness check";
  }
  if (!page.adsReadinessCheckedAt || now.getTime() - page.adsReadinessCheckedAt.getTime() > ADS_READINESS_MAX_AGE_MS) {
    return "Readiness snapshot đã quá 24 giờ";
  }
  if (page.adAccountStatus !== 1) return "Ad Account không ở trạng thái hoạt động";
  if (page.adAccountCurrency !== "VND") return "Ad Account không dùng currency VND";
  return null;
}
