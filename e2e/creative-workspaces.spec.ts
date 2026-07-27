import { expect, test, type Page } from "@playwright/test";

const owner = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password",
};
const viewer = {
  email: process.env.E2E_VIEWER_EMAIL ?? "viewer-e2e@example.test",
  password: process.env.E2E_VIEWER_PASSWORD ?? "viewer-e2e-password",
};
const pageId = "e2e-creative-page";
const scope = `scope=current&pageId=${pageId}`;

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

async function expectView(page: Page, path: string, view: string, heading: string) {
  await page.goto(`${path}?view=${view}&${scope}`);
  const main = page.locator("#main-content");
  await expect(main.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  await expect(
    main.getByRole("navigation", { name: new RegExp(`Điều hướng ${heading}`) })
      .getByRole("link", { name: new RegExp(heading) }),
  ).toHaveAttribute("aria-current", "page");
}

test("owner can open every canonical Creative view with persisted Page data", async ({ page }) => {
  await login(page, owner);

  await expectView(page, "/creative/ideas", "overview", "Ý tưởng & Nghiên cứu");
  await expect(page.getByRole("heading", { name: "Quy trình peel an toàn E2E" })).toBeVisible();
  await expect(page.getByText(/Brief fixture để kiểm thử hành trình Creative/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Chuyển sang biên tập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo dự án video" })).toBeVisible();

  await expectView(page, "/creative/ideas", "research", "Ý tưởng & Nghiên cứu");
  await expect(page.getByRole("heading", { name: "Tạo kế hoạch nội dung bằng AI" })).toBeVisible();
  await expectView(page, "/creative/ideas", "backlog", "Ý tưởng & Nghiên cứu");
  await expect(page.getByRole("heading", { name: "Kho ý tưởng" })).toBeVisible();
  await expectView(page, "/creative/ideas", "history", "Ý tưởng & Nghiên cứu");
  await expect(page.getByRole("heading", { name: "Dòng thời gian" })).toBeVisible();
  await expect(page.getByText(/Đồng bộ Creative fixture/)).toBeVisible();

  await expectView(page, "/creative/content", "overview", "Biên tập nội dung");
  await expect(page.getByText("Peel da an toàn bắt đầu từ soi da")).toBeVisible();
  await expectView(page, "/creative/content", "editor", "Biên tập nội dung");
  await expect(page.getByRole("button", { name: "Tạo nội dung" })).toBeVisible();
  await page.goto(`/creative/content?view=editor&${scope}&id=e2e-creative-draft`);
  await expect(page.getByRole("heading", { name: "Quy trình peel an toàn E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu nội dung" })).toBeVisible();
  await expectView(page, "/creative/content", "bulk", "Biên tập nội dung");
  await expect(page.getByRole("heading", { name: "Tạo kế hoạch nội dung theo tháng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kế hoạch E2E" })).toBeVisible();
  await expectView(page, "/creative/content", "experiments", "Biên tập nội dung");
  await expectView(page, "/creative/content", "review", "Biên tập nội dung");

  await expectView(page, "/creative/images", "overview", "Xưởng hình ảnh");
  await expect(page.getByText("Ảnh theo mục đích")).toBeVisible();
  await expectView(page, "/creative/images", "create", "Xưởng hình ảnh");
  await expectView(page, "/creative/images", "library", "Xưởng hình ảnh");
  await expectView(page, "/creative/images", "review", "Xưởng hình ảnh");

  await expectView(page, "/creative/video", "overview", "Xưởng video");
  await expect(page.getByText("Video peel E2E")).toBeVisible();
  await expectView(page, "/creative/video", "projects", "Xưởng video");
  await expectView(page, "/creative/video", "review", "Xưởng video");
  await expect(page.getByRole("heading", { name: "QA & Duyệt video" })).toBeVisible();
  await expectView(page, "/creative/video", "jobs", "Xưởng video");
  await expect(page.getByRole("heading", { name: "Công việc video" })).toBeVisible();

  await expectView(page, "/creative/publishing", "overview", "Đăng bài & Thư viện");
  await expect(page.getByText("Kết quả theo kênh")).toBeVisible();
  await expectView(page, "/creative/publishing", "composer", "Đăng bài & Thư viện");
  await expectView(page, "/creative/publishing", "calendar", "Đăng bài & Thư viện");
  await expectView(page, "/creative/publishing", "library", "Đăng bài & Thư viện");
  await expect(page.getByText("Peel da an toàn bắt đầu từ soi da")).toBeVisible();
});

test("Creative navigation clears stale record identity and preserves deliberate handoffs", async ({ page }) => {
  await login(page, owner);
  await page.goto(`/creative/content?view=editor&${scope}&id=e2e-creative-draft`);
  await expect(page.getByRole("heading", { name: "Quy trình peel an toàn E2E" })).toBeVisible();

  await page.getByRole("navigation", { name: "Điều hướng Biên tập nội dung" })
    .getByRole("link", { name: "Hàng loạt" }).click();
  await expect(page).toHaveURL(/view=bulk/);
  await expect(page).not.toHaveURL(/(?:\?|&)id=/);
  await expect(page.getByRole("heading", { name: "Kế hoạch E2E" })).toBeVisible();

  await page.goto(`/creative/ideas?view=overview&${scope}&id=e2e-creative-draft`);
  await page.getByRole("link", { name: "Chuyển sang biên tập" }).click();
  await expect(page).toHaveURL(/\/creative\/content\?(?=.*view=editor)(?=.*id=e2e-creative-draft)/);
  await expect(page.getByRole("heading", { name: "Quy trình peel an toàn E2E" })).toBeVisible();
});

test("viewer reads all Creative data but cannot mutate", async ({ page }) => {
  await login(page, viewer);

  await page.goto(`/creative/ideas?view=overview&${scope}&id=e2e-creative-draft`);
  await expect(page.getByRole("heading", { name: "Quy trình peel an toàn E2E" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chuyển sang biên tập" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tạo dự án video" })).toHaveCount(0);
  await expect(page.getByText("Chỉ chủ sở hữu mới chuyển ý tưởng")).toBeVisible();

  await page.goto(`/creative/content?view=bulk&${scope}`);
  await expect(page.getByRole("heading", { name: "Kế hoạch E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tạo kế hoạch tháng/ })).toHaveCount(0);
  await expect(page.getByText("chỉ chủ sở hữu mới có thể tạo hoặc xóa kế hoạch")).toBeVisible();

  const generate = await page.request.post("/api/bulk", {
    data: { facebookPageId: pageId, month: 8, year: 2026, postsPerWeek: 2, tone: "friendly", postTypes: ["service"] },
  });
  expect(generate.status()).toBe(403);
  const remove = await page.request.delete("/api/bulk", { data: { id: "e2e-bulk-plan" } });
  expect(remove.status()).toBe(403);
  const video = await page.request.post("/api/video-studio/projects", {
    data: { facebookPageId: pageId, sourcePostId: "e2e-creative-draft" },
  });
  expect(video.status()).toBe(403);
});
