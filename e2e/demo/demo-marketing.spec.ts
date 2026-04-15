import { test, expect, Page } from "@playwright/test";

/**
 * Marketing demo video scenes (30-60s short).
 *
 * Each `test()` is recorded as a separate webm by playwright.config.demo.ts,
 * and later concatenated by scripts/build-demo-video.sh.
 *
 * Scene order matters — the build script concatenates videos alphabetically
 * by the scene prefix (01-, 02-, ...).
 */

// Shared helper: log in via /dev-login (requires DEV_LOGIN_EMAIL/PASSWORD in .env.local).
async function devLogin(page: Page) {
  await page.goto("/dev-login");
  const signInButton = page.getByRole("button", { name: /sign in as/i });
  await signInButton.waitFor({ state: "visible", timeout: 10_000 });
  await signInButton.click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

// Helper: hold on a page for N ms while cursor glides to draw attention.
async function hold(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

test.describe.serial("Klasly marketing demo (30-60s)", () => {
  test("01-opening-dashboard", async ({ page }) => {
    await devLogin(page);
    // Scene 1: 8s — KPI hero on dashboard
    await expect(page.locator("body")).toBeVisible();
    await hold(page, 2000);
    await page.mouse.move(640, 360, { steps: 30 });
    await hold(page, 3000);
    // Soft scroll to reveal more widgets
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
    await hold(page, 2500);
  });

  test("02-calendar", async ({ page }) => {
    await devLogin(page);
    // Scene 2: 12s — class calendar
    await page.goto("/calendar");
    await hold(page, 2500);
    await page.mouse.move(400, 300, { steps: 20 });
    await hold(page, 3000);
    await page.mouse.move(900, 450, { steps: 30 });
    await hold(page, 3000);
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await hold(page, 2500);
  });

  test("03-classes", async ({ page }) => {
    await devLogin(page);
    // Scene 3: 10s — class templates
    await page.goto("/classes");
    await hold(page, 2500);
    await page.mouse.move(500, 300, { steps: 25 });
    await hold(page, 2500);
    await page.evaluate(() => window.scrollBy({ top: 250, behavior: "smooth" }));
    await hold(page, 2500);
    await page.mouse.move(700, 400, { steps: 20 });
    await hold(page, 1500);
  });

  test("04-bookings", async ({ page }) => {
    await devLogin(page);
    // Scene 4: 10s — bookings month view
    await page.goto("/bookings");
    await hold(page, 2500);
    await page.mouse.move(640, 300, { steps: 25 });
    await hold(page, 3000);
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await hold(page, 3000);
  });

  test("05-member-schedule", async ({ page }) => {
    await devLogin(page);
    // Scene 5: 12s — member-facing schedule
    await page.goto("/member/schedule");
    await hold(page, 2500);
    await page.mouse.move(500, 350, { steps: 25 });
    await hold(page, 3000);
    await page.mouse.move(800, 400, { steps: 25 });
    await hold(page, 3500);
    await page.evaluate(() => window.scrollBy({ top: 250, behavior: "smooth" }));
    await hold(page, 2000);
  });
});
