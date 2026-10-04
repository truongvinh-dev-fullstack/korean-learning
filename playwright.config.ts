import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./scripts/test-database";

process.env.DATABASE_URL = testDatabaseUrl();
process.env.KOREAN_TEST_DATABASE_ACTIVE = "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60 * 1000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    stdout: "pipe",
    stderr: "pipe",
    command: "pnpm exec tsx scripts/prepare-test-db.ts && pnpm dev -p 3100",
    url: "http://localhost:3100",
    env: { DATABASE_URL: process.env.DATABASE_URL, BETTER_AUTH_URL: "http://localhost:3100", NEXT_PUBLIC_APP_URL: "http://localhost:3100", AI_LESSON_PROVIDER: "mock" },
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
