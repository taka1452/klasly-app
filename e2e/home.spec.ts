import { test, expect } from "@playwright/test";

test("homepage redirects to login for unauthenticated users", async ({
  page,
}) => {
  await page.goto("/");
  // Unauthenticated users should be redirected to login
  await expect(page).toHaveURL(/login|sign-in|auth/);
});

test("login page renders correctly", async ({ page }) => {
  await page.goto("/login");
  // Check that the page loaded without errors
  await expect(page.locator("body")).toBeVisible();
});
