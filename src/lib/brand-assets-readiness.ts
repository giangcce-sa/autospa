import type { BrandAssetsPageReadiness } from "@/lib/brand-assets-overview";

export const BRAND_ASSET_AREAS = [
  { view: "kit", label: "Bộ nhận diện", ready: (page: BrandAssetsPageReadiness) => page.hasBrandKit },
  { view: "services", label: "Dịch vụ", ready: (page: BrandAssetsPageReadiness) => page.serviceCount > 0 },
  { view: "staff", label: "Nhân viên & consent", ready: (page: BrandAssetsPageReadiness) => page.consentedStaffCount > 0 },
  { view: "stories", label: "Câu chuyện", ready: (page: BrandAssetsPageReadiness) => page.storyCount > 0 },
  { view: "style", label: "Văn phong", ready: (page: BrandAssetsPageReadiness) => page.approvedStyleSampleCount >= 3 && page.hasStyleProfile },
] as const;

export function getBrandAssetsReadiness(page: BrandAssetsPageReadiness) {
  const checks = BRAND_ASSET_AREAS.map((area) => area.ready(page));
  return { complete: checks.filter(Boolean).length, total: checks.length, ready: checks.every(Boolean) };
}
