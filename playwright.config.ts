import { defineConfig, devices } from "@playwright/test"

/**
 * Read-only smoke tests against a deployed environment (production by
 * default). They never create teams, games or accounts.
 *
 *   TEACHER_URL=https://app.kusteam.app PLAY_URL=https://play.kusteam.app npx playwright test
 */
export default defineConfig({
  testDir: "e2e",
  // e2e/local needs a local Supabase stack and has its own config
  // (playwright.local.config.ts, npm run test:e2e:local).
  testIgnore: "**/e2e/local/**",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
})
