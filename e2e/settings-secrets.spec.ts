import { expect, test, type Page } from "@playwright/test";

const owner = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password",
};

const MASK_PREFIX = "•".repeat(8);

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

async function readClaudeMask(page: Page) {
  const response = await page.request.get("/api/settings");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  return body.data?.claudeApiKey ?? null;
}

// Each browser project reruns this spec against the shared DB; every step
// overwrites the key, so the flow is idempotent across desktop/tablet/mobile.
test("saving a Claude key masks it, mask round-trips do not clobber, and new keys flip the suffix", async ({ page }) => {
  await login(page, owner);

  // 1. Save a fresh key: response masks it as 8 bullets + last 4 characters.
  const save = await page.request.post("/api/settings", {
    data: { claudeApiKey: "sk-e2e-test-abcd1234" },
  });
  expect(save.status()).toBe(200);
  const saved = await save.json();
  expect(saved.success).toBe(true);
  expect(saved.data.claudeApiKey).toBe(`${MASK_PREFIX}1234`);

  // 2. GET returns the same mask.
  expect(await readClaudeMask(page)).toBe(`${MASK_PREFIX}1234`);

  // 3. Posting the masked value back must NOT clobber the stored secret.
  const maskedRoundTrip = await page.request.post("/api/settings", {
    data: { claudeApiKey: `${MASK_PREFIX}1234` },
  });
  expect(maskedRoundTrip.status()).toBe(200);
  expect(await readClaudeMask(page)).toBe(`${MASK_PREFIX}1234`);

  // 4. Saving a different key flips the revealed suffix.
  const rotate = await page.request.post("/api/settings", {
    data: { claudeApiKey: "sk-e2e-test-efgh5678" },
  });
  expect(rotate.status()).toBe(200);
  const rotated = await rotate.json();
  expect(rotated.data.claudeApiKey).toBe(`${MASK_PREFIX}5678`);
  expect(await readClaudeMask(page)).toBe(`${MASK_PREFIX}5678`);
});

test("provider Settings UI signals a stored key without revealing it", async ({ page }) => {
  await login(page, owner);

  // Guarantee a stored key regardless of test ordering within the project run.
  const save = await page.request.post("/api/settings", {
    data: { claudeApiKey: "sk-e2e-test-abcd1234" },
  });
  expect(save.status()).toBe(200);

  await page.goto("/system/settings?view=providers&scope=account");
  await expect(page).toHaveURL(/\/system\/settings\?(?=.*view=providers)(?=.*scope=account)/);

  // hasClaudeApiKey=true switches the placeholder to "keep the current key".
  const claudeKeyInput = page.getByPlaceholder("Để trống = giữ khóa hiện tại").first();
  await expect(claudeKeyInput).toBeVisible();
  await expect(claudeKeyInput).toHaveValue("");
});
