/**
 * Vendor e2e tests — dashboard, RFQ inbox, orders, profile.
 * Uses saved vendor auth cookies from global-setup.
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from './support/auth';

test.use({ storageState: STORAGE.vendor });

test.describe('Vendor — Dashboard', () => {
  test('loads vendor dashboard', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await expect(page).toHaveURL(/\/vendor\/dashboard/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Vendor — RFQ Inbox', () => {
  test('RFQ inbox page loads', async ({ page }) => {
    await page.goto('/vendor/rfq');
    await expect(page).toHaveURL(/\/vendor\/rfq/);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Vendor — Orders', () => {
  test('orders page loads', async ({ page }) => {
    await page.goto('/vendor/orders');
    await expect(page).toHaveURL(/\/vendor\/orders/);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Vendor — Profile', () => {
  test('profile page loads', async ({ page }) => {
    await page.goto('/vendor/profile');
    await expect(page).toHaveURL(/\/vendor\/profile/);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Vendor — Redirect protection', () => {
  test('vendor cannot access /admin route', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // Should be redirected to login (vendor not allowed on admin routes)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
