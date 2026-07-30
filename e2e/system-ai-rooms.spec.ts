import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/auth";

const rooms = [
  ["overview", "Tổng quan"],
  ["council", "Phòng tư vấn"],
  ["brain", "Kỹ năng"],
  ["memory", "Quyết định"],
  ["orchestrator", "Điều phối"],
  ["approvals", "Phê duyệt"],
] as const;

const ownerRooms = [...rooms, ["operations", "Vận hành"]] as const;

async function expectCanonicalRoom(page: Page, view: typeof ownerRooms[number][0], label: string) {
  await page.goto(`/system/ai-rooms?view=${view}&scope=account`);
  await expect(page).toHaveURL(new RegExp(`/system/ai-rooms\\?view=${view}&scope=account`));
  const main = page.locator("#main-content");
  const navigation = main.getByRole("navigation", { name: "Điều hướng Phòng họp AI" });
  await expect(main.getByRole("heading", { name: "Phòng họp AI", level: 1 })).toBeVisible();
  await expect(main.getByText("Toàn tài khoản", { exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
}

test("protected System routes redirect to the real login flow", async ({ page }) => {
  await page.goto("/system/ai-rooms?view=overview&scope=account");
  await expect(page).toHaveURL(/\/login\?from=/);
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
});

test("owner can read every canonical AI Room and sees owner controls", async ({ ownerPage: page }) => {

  await page.goto("/system");
  await expect(page.getByRole("heading", { name: "Trung tâm điều hành hệ thống", level: 1 })).toBeVisible();

  for (const [view, label] of ownerRooms) await expectCanonicalRoom(page, view, label);

  await page.goto("/system/ai-rooms?view=brain&scope=account");
  await expect(page.locator("#main-content").getByRole("heading", { name: "Dạy kỹ năng mới" })).toBeVisible();

  await page.goto("/system/ai-rooms?view=orchestrator&scope=account");
  const orchestrator = page.locator("#main-content");
  await expect(orchestrator.getByRole("heading", { name: "Execution policy hiệu lực" })).toBeVisible();
  await expect(orchestrator.getByText(/Refresh và GET chỉ đọc dữ liệu persisted/)).toBeVisible();
  await expect(orchestrator.getByRole("heading", { name: "Tác vụ owner" })).toBeVisible();
  await expect(orchestrator.getByRole("button", { name: "Chạy orchestrator" })).toBeVisible();
  await expect(orchestrator.getByRole("button", { name: "Chạy monitor" })).toBeVisible();
  await expect(orchestrator.getByRole("heading", { name: "Realtime alerts owner-only" })).toBeVisible();
  await expect(orchestrator.getByRole("heading", { name: "API quota owner-only" })).toBeVisible();

  await page.goto("/system/ai-rooms?view=operations&scope=account");
  const operations = page.locator("#main-content");
  await expect(operations.getByRole("heading", { name: "Ads deployment policy hiệu lực" })).toBeVisible();
  await expect(operations.getByRole("heading", { name: "Ads readiness persisted theo Page" })).toBeVisible();
  await expect(operations.getByRole("heading", { name: "Spa sync persisted" })).toBeVisible();
  await expect(operations.getByRole("button", { name: "Chạy Ads dry-run" })).toBeVisible();
  await expect(operations.getByRole("button", { name: "Kiểm tra kết nối Spa" })).toBeVisible();
  await expect(operations.getByRole("button", { name: "Đồng bộ doanh thu Spa" })).toBeVisible();
});

test("owner filters Brain metadata and persists status and outcome actions", async ({ ownerPage: page }) => {
  const resetResponse = await page.request.patch("/api/brain", {
    data: { id: "e2e-brain-skill", status: "draft" },
  });
  expect(resetResponse.ok()).toBe(true);

  await page.goto("/system/ai-rooms?view=brain&scope=account&domain=content&category=caption&status=draft&risk=medium&q=Caption");
  const main = page.locator("#main-content");
  const skill = main.locator("article").filter({
    has: page.getByRole("button", { name: "Outcome tốt" }),
  });

  await expect(page).toHaveURL(/(?=.*view=brain)(?=.*domain=content)(?=.*category=caption)(?=.*status=draft)(?=.*risk=medium)(?=.*q=Caption)/);
  await expect(skill.getByRole("heading", { name: "E2E Caption Guard" })).toBeVisible();
  await skill.getByText("Playbook và provenance", { exact: true }).click();
  await expect(skill.getByText("Review caption trước khi publish.")).toBeVisible();
  await expect(skill.getByText("E2E council provenance", { exact: false })).toBeVisible();

  const statusResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/brain") && response.request().method() === "PATCH",
  );
  await skill.getByRole("button", { name: "Kích hoạt" }).click();
  expect((await statusResponsePromise).ok()).toBe(true);

  await page.goto("/system/ai-rooms?view=brain&scope=account&domain=content&status=active&q=Caption");
  await expect(skill.getByRole("heading", { name: "E2E Caption Guard" })).toBeVisible();
  await expect(skill.getByText("active", { exact: true })).toBeVisible();

  const outcomeResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/brain") && response.request().method() === "POST",
  );
  await skill.getByRole("button", { name: "Outcome tốt" }).click();
  expect((await outcomeResponsePromise).ok()).toBe(true);
  await page.reload();
  await expect(skill.locator("p").filter({ hasText: "Latest outcome:" })).toContainText("success");
});

test("viewer reads canonical AI Rooms but cannot see or call owner actions", async ({ viewerPage: page }) => {

  for (const [view, label] of rooms) await expectCanonicalRoom(page, view, label);

  await page.goto("/system/ai-rooms?view=brain&scope=account");
  const main = page.locator("#main-content");
  await expect(main.getByText("Viewer chỉ có quyền đọc", { exact: false })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Dạy kỹ năng mới" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Kích hoạt" })).toHaveCount(0);
  const statusResponse = await page.request.patch("/api/brain", { data: { id: "e2e-brain-skill", status: "active" } });
  expect(statusResponse.status()).toBe(403);
  const outcomeResponse = await page.request.post("/api/brain", { data: { action: "outcome", skillId: "e2e-brain-skill", status: "success" } });
  expect(outcomeResponse.status()).toBe(403);

  await page.goto("/system/ai-rooms?view=orchestrator&scope=account");
  await expect(main.getByRole("heading", { name: "Execution policy hiệu lực" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Tác vụ owner" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Realtime alerts owner-only" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "API quota owner-only" })).toHaveCount(0);
  const response = await page.request.post("/api/orchestrator");
  expect(response.status()).toBe(403);
  const workflowResponse = await page.request.post("/api/workflows", { data: { name: "revenue_drop" } });
  expect(workflowResponse.status()).toBe(403);
  const monitorResponse = await page.request.post("/api/realtime-alerts", { data: { action: "run-now" } });
  expect(monitorResponse.status()).toBe(403);
  const alertsResponse = await page.request.get("/api/realtime-alerts");
  expect(alertsResponse.status()).toBe(403);
  const quotaResponse = await page.request.get("/api/rate-limit");
  expect(quotaResponse.status()).toBe(403);
  await expect(main.getByRole("link", { name: "Vận hành", exact: true })).toHaveCount(0);
  await page.goto("/system/ai-rooms?view=operations&scope=account");
  await expect(main.getByText("Không thể mở Phòng họp AI")).toBeVisible();
  const automationResponse = await page.request.get("/api/automation");
  expect(automationResponse.status()).toBe(403);
  const adsRunResponse = await page.request.post("/api/automation/ads-run");
  expect(adsRunResponse.status()).toBe(403);
});

test("legacy AI aliases preserve query state and owner-only access", async ({ viewerPage: page }) => {
  const main = page.locator("#main-content");

  await page.goto("/council?source=legacy");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=council)(?=.*scope=account)(?=.*source=legacy)/);
  await expect(main.getByRole("link", { name: "Phòng tư vấn", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/ceo-memory?status=neutral");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=memory)(?=.*scope=account)(?=.*status=neutral)/);
  await expect(main.getByRole("link", { name: "Quyết định", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/brain?domain=content");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=brain)(?=.*scope=account)(?=.*domain=content)/);
  await expect(main.getByRole("link", { name: "Kỹ năng", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/orchestrator?source=legacy");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=orchestrator)(?=.*scope=account)(?=.*source=legacy)/);
  await expect(main.getByRole("link", { name: "Điều phối", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/automation?source=legacy");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=operations)(?=.*scope=account)(?=.*source=legacy)/);
  await expect(main.getByText("Không thể mở Phòng họp AI")).toBeVisible();
  await expect(main.getByRole("link", { name: "Vận hành", exact: true })).toHaveCount(0);
});

test("owner reaches Operations through the legacy automation alias", async ({ ownerPage: page }) => {
  await page.goto("/automation?source=legacy");
  await expect(page).toHaveURL(/\/system\/ai-rooms\?(?=.*view=operations)(?=.*scope=account)(?=.*source=legacy)/);
  const main = page.locator("#main-content");
  await expect(main.getByRole("link", { name: "Vận hành", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(main.getByRole("heading", { name: "Ads deployment policy hiệu lực" })).toBeVisible();
});

test("URL state survives navigation, refresh and browser history", async ({ viewerPage: page }) => {
  await page.goto("/system/ai-rooms?view=brain&scope=account");
  await page.reload();
  await expect(page.getByRole("link", { name: "Kỹ năng", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Quyết định", exact: true }).click();
  await expect(page).toHaveURL(/view=memory/);
  await page.goBack();
  await expect(page).toHaveURL(/view=brain/);
  await expect(page.getByRole("link", { name: "Kỹ năng", exact: true })).toHaveAttribute("aria-current", "page");
});
