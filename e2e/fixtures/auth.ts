import { expect, test as base, type Page } from "@playwright/test";

export const ownerCredentials = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password",
};

export const viewerCredentials = {
  email: process.env.E2E_VIEWER_EMAIL ?? "viewer-e2e@example.test",
  password: process.env.E2E_VIEWER_PASSWORD ?? "viewer-e2e-password",
};

export async function login(page: Page, credentials = ownerCredentials) {
  await page.goto("/login");
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Đăng nhập" }),
    visible: true,
  });
  await form.getByLabel("Email").filter({ visible: true }).fill(credentials.email);
  await form.getByLabel("Mật khẩu").filter({ visible: true }).fill(credentials.password);
  await form.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

export const test = base.extend<{
  ownerPage: Page;
  viewerPage: Page;
}>({
  ownerPage: async ({ page }, provide) => {
    await login(page, ownerCredentials);
    await provide(page);
  },
  viewerPage: async ({ browser }, provide) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await login(page, viewerCredentials);
      await provide(page);
    } finally {
      await context.close();
    }
  },
});

export { expect } from "@playwright/test";
