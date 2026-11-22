import { defineConfig, devices } from "@playwright/test"

/**
 * The whole lesson against a throwaway local Supabase stack
 * (e2e/local/full-lesson.spec.ts, docs/e2e-local.md). It creates an activity,
 * teams and answers, so it only ever runs against this machine:
 *
 *   npm run test:e2e:local
 *
 * The production smoke test keeps its own config (playwright.config.ts).
 */
const baseURL = process.env.E2E_LOCAL_URL || "http://localhost:3000"
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL)) {
  throw new Error(`E2E_LOCAL_URL must be a local address, got ${baseURL}`)
}

export default defineConfig({
  testDir: "e2e/local",
  outputDir: "test-results-local",
  // One lesson, told step by step: the steps share the activity and the
  // browser contexts, so they run in order in one worker and are not retried.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report-local" }]]
    : "list",
  use: {
    baseURL,
    trace: "off",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
