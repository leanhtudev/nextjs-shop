import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the PRODUCTION build (the same standalone server.js the Docker image runs),
 * not `next dev`, so caching, Server Actions and streaming behave as they do on ECS.
 *
 *   npm run build && npm run test:e2e
 *
 * BASE_URL lets the same specs smoke-test a deployed environment (CD runs them after a deploy).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const externalBaseUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray test.only fails CI instead of silently skipping the rest
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Start the standalone server unless we are pointed at an already running environment.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "node scripts/start-standalone.mjs",
        url: `http://127.0.0.1:${PORT}/api/health`,
        env: { PORT: String(PORT), HOSTNAME: "127.0.0.1" },
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
