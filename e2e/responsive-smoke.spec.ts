import { expect, test } from "./fixtures/auth";

const pageId = "e2e-creative-page";

for (const workspace of [
  { path: "/creative/ideas", heading: "Ý tưởng & Nghiên cứu" },
  { path: "/growth/ads", heading: "Ads Manager" },
  { path: "/system/settings", heading: "Cài đặt & Kết nối" },
]) {
  test(`${workspace.heading} remains usable at the responsive smoke viewport`, async ({ ownerPage: page }) => {
    await page.goto(`${workspace.path}?view=overview&scope=current&pageId=${pageId}`);
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: workspace.heading, level: 1 })).toBeVisible();
    await expect(main).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
}

for (const dashboard of [
  { path: `/growth?scope=current&pageId=${pageId}`, heading: "Trung tâm tăng trưởng", nextTab: "Hiệu quả" },
  { path: "/system", heading: "Trung tâm điều hành hệ thống", nextTab: "Cấu hình" },
  { path: `/customers?scope=current&pageId=${pageId}`, heading: "Hội thoại & Lead", nextTab: "Lead" },
]) {
  test(`${dashboard.heading} exposes keyboard compact tabs without horizontal overflow`, async ({ ownerPage: page }) => {
    await page.goto(dashboard.path);
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: dashboard.heading, level: 1 })).toBeVisible();
    const tabs = main.getByRole("tablist", { name: "Nhóm dữ liệu dashboard" });
    const firstTab = tabs.getByRole("tab").first();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    await firstTab.focus();
    await firstTab.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: dashboard.nextTab })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
}

test("Customer Inbox uses canonical list and record modes at the responsive smoke viewport", async ({ ownerPage: page }) => {
  await page.goto(`/customers/inbox?view=queue&scope=current&pageId=${pageId}`);
  const main = page.locator("#main-content");
  await expect(main.getByRole("heading", { name: "Hộp thư", level: 1 })).toBeVisible();
  const records = main.getByRole("link").filter({ hasText: /Có reply được lưu|Chưa có reply/ });
  if (await records.count()) {
    await records.first().click();
    await expect(page).toHaveURL(/view=conversation/);
    await expect(page).toHaveURL(new RegExp(`pageId=${pageId}`));
    await expect(main.getByRole("link", { name: "Quay lại hàng đợi" })).toBeVisible();
  }
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
