import { expect, test } from "./fixtures/auth";

// Same secret list the smoke test enforces for /api/settings responses.
const SECRET_FIELDS = [
  "claudeApiKey",
  "openaiApiKey",
  "zaloToken",
  "spaApiKey",
  "spaWebhookSecret",
  "telegramBotToken",
] as const;

test("viewer is denied on every owner-only Settings surface", async ({ viewerPage: page }) => {

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

test("owner reads Settings and every secret comes back masked or absent", async ({ ownerPage: page }) => {

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
