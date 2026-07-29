import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-full",
      testIgnore: /responsive-smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
    {
      name: "tablet-smoke",
      testMatch: /responsive-smoke\.spec\.ts/,
      use: { ...devices["iPad Pro 11"], browserName: "chromium" },
    },
    {
      name: "mobile-smoke",
      testMatch: /responsive-smoke\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          AUTH_URL: baseURL,
          NEXTAUTH_URL: baseURL,
          AUTH_TRUST_HOST: "true",
        },
      },
});
