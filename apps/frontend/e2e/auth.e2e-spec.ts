/**
 * Auth e2e tests — login UI flow (no storageState, tests the raw UI).
 * Requires: frontend on :3000, backend on :3001, E2E_TEST_OTP set on backend.
 *
 * Throttle note: backend has @Throttle(5, 60) on send-otp and verify-otp.
 * Global-setup already uses vendor/admin phones once each.
 * To avoid hitting the limit, the full-login tests for buyer/vendor/admin
 * use a 30 s gap and run strictly sequentially (workers: 1).
 */
import { test, expect } from '@playwright/test';
import { PHONES, E2E_OTP } from './support/auth';

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input#phone')).toBeVisible();
  });

  test('login page renders phone step', async ({ page }) => {
    await expect(page.locator('input#phone')).toBeVisible();
    await expect(page.getByRole('button', { name: /get otp/i })).toBeVisible();
  });

  test('invalid phone shows validation error', async ({ page }) => {
    await page.fill('input#phone', '1234');
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.getByText(/valid indian phone/i)).toBeVisible();
  });

  test('valid phone transitions to OTP step', async ({ page }) => {
    await page.fill('input#phone', PHONES.buyer);
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.locator('input#otp')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /verify otp/i })).toBeVisible();
  });

  test('buyer: full login redirects to /buyer/dashboard', async ({ page }) => {
    await page.fill('input#phone', PHONES.buyer);
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.locator('input#otp')).toBeVisible({ timeout: 10_000 });
    await page.fill('input#otp', E2E_OTP);
    await page.getByRole('button', { name: /verify otp/i }).click();
    await expect(page).toHaveURL(/\/buyer\/dashboard/, { timeout: 15_000 });
  });

  test('vendor: full login redirects to /vendor/dashboard', async ({ page }) => {
    // This test needs extra time: 65 s throttle wait + login flow.
    test.setTimeout(120_000);
    // Wait 65 s to ensure the throttle window (60 s) from global-setup resets.
    // global-setup calls send-otp + verify-otp for the vendor phone once, and
    // the previous tests may have called send-otp for buyer once.
    await page.waitForTimeout(65_000);
    await page.fill('input#phone', PHONES.vendor);
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.locator('input#otp')).toBeVisible({ timeout: 15_000 });
    await page.fill('input#otp', E2E_OTP);
    await page.getByRole('button', { name: /verify otp/i }).click();
    await expect(page).toHaveURL(/\/vendor\/dashboard/, { timeout: 15_000 });
  });

  test('admin: full login redirects to /admin/dashboard', async ({ page }) => {
    // This test needs extra time: 65 s throttle wait + login flow.
    test.setTimeout(120_000);
    // Wait to ensure throttle window resets for the admin phone.
    await page.waitForTimeout(65_000);
    await page.fill('input#phone', PHONES.admin);
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.locator('input#otp')).toBeVisible({ timeout: 15_000 });
    await page.fill('input#otp', E2E_OTP);
    await page.getByRole('button', { name: /verify otp/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });
  });

  test('back button returns to phone step from OTP step', async ({ page }) => {
    // Wait briefly to avoid hitting rate limit from previous send-otp calls
    await page.waitForTimeout(2_000);
    await page.fill('input#phone', PHONES.buyer);
    await page.getByRole('button', { name: /get otp/i }).click();
    await expect(page.locator('input#otp')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /change number/i }).click();
    await expect(page.locator('input#phone')).toBeVisible();
  });
});
