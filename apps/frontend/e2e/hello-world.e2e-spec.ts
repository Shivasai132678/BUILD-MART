/**
 * Smoke test — verifies the BuildMart app is accessible and core pages load.
 *
 * Notes on app behaviour (discovered via e2e exploration):
 *  - Root "/" is NOT guarded by middleware; it renders the home/marketing page.
 *  - Unknown routes are also NOT redirected; the app renders them at their URL
 *    (Next.js 404 page) without a redirect to /login.
 *  - Protected routes (/buyer/*, /vendor/*, /admin/*) DO redirect to /login.
 */
import { test, expect } from '@playwright/test';

test.describe('BuildMart smoke test', () => {
  test('root "/" is accessible without authentication (not redirected to login)', async ({ page }) => {
    await page.goto('/');
    // Root is the home/marketing page — not protected, so it stays at /
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10_000 });
  });

  test('login page has correct title and phone input', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    // Phone input is the entry point
    await expect(page.locator('input#phone')).toBeVisible({ timeout: 10_000 });
    // Page title contains BuildMart
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/buildmart|build mart|login/i);
  });

  test('protected route /buyer/dashboard redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    // Middleware guards /buyer/*, so unauthenticated user must be sent to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('protected route /vendor/dashboard redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('protected route /admin/dashboard redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
