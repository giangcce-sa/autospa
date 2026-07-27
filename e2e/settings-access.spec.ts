import { expect, test, type Page } from "@playwright/test";

const owner = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password",
};
const viewer = {
  email: process.env.E2E_VIEWER_EMAIL ?? "viewer-e2e@example.test",
  password: process.env.E2E_VIEWER_PASSWORD ?? "viewer-e2e-password",
};

// Same secret list the smoke test enforces for /api/settings responses.
const SECRET_FIELDS = [
  "claudeApiKey",
  "openaiApiKey",
  "zaloToken",
  "spaApiKey",
  "spaWebhookSecret",
  "telegramBotToken",
] as const;

async function login(page: Page, credentials: typeof owner) {
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

test("viewer is denied on every owner-only Settings surface", async ({ page }) => {
  await login(page, viewer);

  const read = await page.request.get("/api/settings");
  expect(read.status()).toBe(403);

  const write = await page.request.post("/api/settings", {
    data: { claudeApiKey: "sk-viewer-should-never-write" },
  });
  expect(write.status()).toBe(403);

  const addPage = await page.request.post("/api/facebook-pages", {
    data: { action: "add", pageId: "viewer-blocked", pageName: "Viewer Blocked", accessToken: "blocked" },
  });
  expect(addPage.status()).toBe(403);

  const telegram = await page.request.post("/api/telegram", { data: { action: "get" } });
  expect(telegram.status()).toBe(403);

  const competitors = await page.request.post("/api/competitors", {
    data: { action: "create", name: "Viewer Blocked Spa" },
  });
  expect(competitors.status()).toBe(403);
});

test("owner reads Settings and every secret comes back masked or absent", async ({ page }) => {
  await login(page, owner);

  const response = await page.request.get("/api/settings");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.success).toBe(true);

  for (const field of SECRET_FIELDS) {
    const value = body.data?.[field] ?? null;
    if (value !== null) {
      expect(typeof value).toBe("string");
      expect(String(value).startsWith("••"), `${field} must be masked, saw: ${String(value).slice(0, 4)}…`).toBe(true);
    }
  }
});
