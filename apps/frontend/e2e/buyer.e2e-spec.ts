/**
 * Buyer e2e tests — dashboard, catalog, RFQ, orders.
 * Uses saved buyer auth cookies from global-setup.
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from './support/auth';

test.use({ storageState: STORAGE.buyer });

test.describe('Buyer — Dashboard', () => {
  test('loads dashboard with stat cards', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    await expect(page).toHaveURL(/\/buyer\/dashboard/);
    // At least one stat card should be visible
    await expect(page.locator('text=/rfq|order|active/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('has "New RFQ" link on dashboard', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    const newRfqLink = page.getByRole('link', { name: /new rfq/i }).or(
      page.getByRole('button', { name: /new rfq/i })
    );
    await expect(newRfqLink.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Buyer — Catalog', () => {
  test('catalog page loads with products', async ({ page }) => {
    await page.goto('/buyer/catalog');
    await expect(page).toHaveURL(/\/buyer\/catalog/);
    // Wait for product grid to appear (products loaded from API)
    await page.waitForLoadState('networkidle');
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Buyer — RFQ', () => {
  test('RFQ list page loads', async ({ page }) => {
    await page.goto('/buyer/rfq');
    await expect(page).toHaveURL(/\/buyer\/rfq/);
    await page.waitForLoadState('networkidle');
  });

  test('new RFQ page renders form', async ({ page }) => {
    await page.goto('/buyer/rfq/new');
    await expect(page).toHaveURL(/\/buyer\/rfq\/new/);
    // Form should have an "Add another item" button
    await expect(
      page.getByRole('button', { name: /add another item/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('new RFQ page has product selector, address selector, date field', async ({ page }) => {
    await page.goto('/buyer/rfq/new');
    await page.waitForLoadState('networkidle');
    // validUntil date input
    const dateInput = page.locator('input[name="validUntil"]').or(
      page.locator('input[type="date"]')
    );
    await expect(dateInput.first()).toBeVisible({ timeout: 10_000 });
    // Product selector — rendered as a <select> for each item row
    const productSelector = page.locator('select').first();
    await expect(productSelector).toBeVisible({ timeout: 10_000 });
    // Delivery address section heading — always rendered regardless of saved addresses
    await expect(page.getByText('Delivery Address')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Buyer — Orders', () => {
  test('orders page loads', async ({ page }) => {
    await page.goto('/buyer/orders');
    await expect(page).toHaveURL(/\/buyer\/orders/);
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Buyer — Redirect protection', () => {
  test('unauthenticated /vendor route redirects to login', async ({ browser }) => {
    // Use a fresh context (no auth cookies)
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/vendor/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });
});
