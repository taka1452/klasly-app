import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated Playwright config for recording marketing demo videos.
 * Runs in sequence (workers: 1) so that scene order is deterministic,
 * and outputs a webm video per scene (one `test()` == one scene).
 *
 * Usage:
 *   npm run demo:record
 *
 * Output:
 *   test-results/demo/<scene-name>/video.webm
 */
export default defineConfig({
  testDir: "./e2e/demo",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/demo",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
    video: {
      mode: "on",
      size: { width: 1280, height: 720 },
    },
    // Slow down actions slightly so motion reads well on video
    launchOptions: {
      slowMo: 150,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
