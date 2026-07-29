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
