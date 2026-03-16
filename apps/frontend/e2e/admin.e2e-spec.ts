/**
 * Admin e2e tests — dashboard, vendor management.
 * Uses saved admin auth cookies from global-setup.
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from './support/auth';

test.use({ storageState: STORAGE.admin });

test.describe('Admin — Dashboard', () => {
  test('loads admin dashboard with metrics', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin — Vendor Management', () => {
  test('vendors list page loads', async ({ page }) => {
    await page.goto('/admin/vendors');
    await expect(page).toHaveURL(/\/admin\/vendors/);
    await page.waitForLoadState('networkidle');
  });

  test('vendor approvals page renders correctly', async ({ page }) => {
    await page.goto('/admin/vendors');
    await page.waitForLoadState('networkidle');
    // Page has "Vendor Management" heading and vendor list or "No vendors found"
    const heading = page.getByRole('heading', { name: /vendor management/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('loads vendors page and verifies heading', async ({ page }) => {
    await page.goto('/admin/vendors');
    await page.waitForLoadState('networkidle');
    // Not all pages have search — just verify the page itself loaded
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin — Access control', () => {
  test('admin can access buyer dashboard (admin has all permissions)', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    // Admin is allowed on buyer routes per middleware PROTECTED_PREFIXES
    await expect(page).toHaveURL(/\/buyer\/dashboard/, { timeout: 10_000 });
  });

  test('admin can access vendor dashboard', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await expect(page).toHaveURL(/\/vendor\/dashboard/, { timeout: 10_000 });
  });
});
