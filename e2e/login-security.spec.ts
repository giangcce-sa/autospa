import { expect, test, type Page } from "@playwright/test";
import { LOGIN_FAIL_LIMIT } from "../src/lib/login-rate-policy";

const owner = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password",
};

const GENERIC_ERROR = "Email hoặc mật khẩu không đúng";
const LOCKOUT_ERROR = "Tài khoản tạm khóa do nhập sai nhiều lần — thử lại sau khoảng 15 phút";

// Submits the login form once and waits for the credentials callback to settle.
async function submitLogin(page: Page, email: string, password: string) {
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Đăng nhập" }),
    visible: true,
  });
  await form.getByLabel("Email").filter({ visible: true }).fill(email);
  await form.getByLabel("Mật khẩu").filter({ visible: true }).fill(password);
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/callback/credentials"),
  );
  await form.getByRole("button", { name: "Đăng nhập" }).click();
  await responsePromise;
}

test("a single wrong password shows the generic error and never locks the seeded owner", async ({ page }) => {
  await page.goto("/login");

  await submitLogin(page, owner.email, "definitely-wrong-password");
  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect(page.getByText(LOCKOUT_ERROR)).toHaveCount(0);
  await expect(page).toHaveURL(/\/login/);

  // The correct password still works right away — one failure stays far below the
  // limit, and the successful login resets the owner's failure bucket.
  await submitLogin(page, owner.email, owner.password);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
});

test("repeated failures lock the throwaway identity but the seeded owner still logs in", async ({ page }, testInfo) => {
  // All three projects share one server and, on localhost, one x-forwarded-for-less
  // "unknown" IP bucket (30 failures/15min). Burning ~11 failures per project would
  // trip the IP-wide lockout by the third project and block every later login —
  // so the expensive lockout walk runs once, on desktop only.
  test.skip(testInfo.project.name !== "desktop", "lockout budget is IP-wide; run once per suite");

  // This address is never seeded — locking it cannot break other specs.
  const throwawayEmail = `lockout-${testInfo.project.name}@example.test`;

  await page.goto("/login");

  // First failure: generic error, no lockout yet.
  await submitLogin(page, throwawayEmail, "wrong-password");
  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect(page.getByText(LOCKOUT_ERROR)).toHaveCount(0);

  // Burn the remaining failure budget (only FAILED attempts count).
  for (let attempt = 2; attempt <= LOGIN_FAIL_LIMIT; attempt++) {
    await submitLogin(page, throwawayEmail, "wrong-password");
  }

  // Budget spent: the next attempt is rejected with the distinct lockout message.
  await submitLogin(page, throwawayEmail, "wrong-password");
  await expect(page.getByText(LOCKOUT_ERROR)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // Scoping proof: the limiter keys on the normalized email, not globally or by
  // IP alone — the seeded owner logs in from the same browser context.
  await submitLogin(page, owner.email, owner.password);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
});
