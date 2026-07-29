import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/auth";

const pageId = "e2e-creative-page";
const scope = `scope=current&pageId=${pageId}`;

async function openAdsView(page: Page, view: string) {
  await page.goto(`/growth/ads?view=${view}&${scope}`);
  await expect(page.locator("#main-content").getByRole("heading", { name: "Ads Manager", level: 1 })).toBeVisible();
}

test("owner sees truthful Ads readiness, unavailable provenance and persisted operations", async ({ ownerPage: page }) => {
  await openAdsView(page, "overview");
  const main = page.locator("#main-content");
  await expect(main.getByText("Chưa cấu hình Ad Account ID", { exact: true })).toBeVisible();
  await expect(main.getByText("Dữ liệu chưa khả dụng")).toBeVisible();
  await expect(main.getByText(/Nguồn: Meta Marketing API/)).toBeVisible();
  await expect(main.getByText("Vận hành gần đây")).toBeVisible();
  await expect(main.getByText("e2e-ads-operation")).toBeVisible();
  await expect(main.getByText("E2E provider unavailable fixture")).toBeVisible();

  await openAdsView(page, "insights");
  await expect(main.getByText("Dữ liệu chưa khả dụng").first()).toBeVisible();
  await expect(main.getByText(/Chưa cấu hình Ad Account ID/).first()).toBeVisible();

  await openAdsView(page, "operations");
  await expect(main.getByRole("heading", { name: "Checkpoint và recovery" })).toBeVisible();
  await expect(main.getByText("e2e-campaign", { exact: false })).toBeVisible();

  await openAdsView(page, "create");
  await expect(main.getByText("Chưa cấu hình Ad Account ID", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Tạo bộ quảng cáo PAUSED" })).toBeDisabled();
});

test("viewer can inspect Ads state but cannot invoke mutations", async ({ viewerPage: page }) => {
  await openAdsView(page, "operations");
  await expect(page.getByText("e2e-ads-operation")).toBeVisible();

  const create = await page.request.post("/api/facebook-ads", {
    data: {
      action: "create",
      facebookPageId: pageId,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      postId: "e2e-creative-draft",
      name: "Viewer blocked",
      targetAgeMin: 25,
      targetAgeMax: 45,
      targetGenders: [2],
      targetCountry: "VN",
      dailyBudgetVnd: 200000,
      objective: "OUTCOME_AWARENESS",
    },
  });
  expect(create.status()).toBe(403);

  const creative = await page.request.post("/api/ads-creative", {
    data: { facebookPageId: pageId },
  });
  expect(creative.status()).toBe(403);
});
