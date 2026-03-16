/**
 * Pending vendor read-only mode tests.
 *
 * Covers the bug fix: a vendor who has submitted their onboarding profile
 * but has not yet been approved should:
 *  1. Be able to log in and reach /vendor/dashboard (not be redirected away)
 *  2. See the yellow "Your account is pending approval" banner
 *  3. NOT be able to access /buyer or /admin routes (middleware blocks PENDING role)
 *
 * Strategy:
 *  - Register a fresh phone number as a new user via API
 *  - Complete vendor onboarding via API (role stays PENDING until admin approves)
 *  - Log in via the UI once in beforeAll and save the session to a temp file
 *  - Reuse the saved session in each test (avoids repeated OTP calls → throttle)
 *
 * Auth note: the shared `request` fixture loses auth cookies on test retry because
 * beforeAll re-runs in a fresh context. Use browser.newContext() for API calls so
 * the cookie jar is self-contained within each browser context.
 */
import { test, expect } from '@playwright/test';
import { E2E_OTP } from './support/auth';
import path from 'node:path';
import os from 'node:os';

const API = 'http://localhost:3001';

let seq = 0;
function freshPhone(): string {
  const ts = Date.now().toString().slice(-7);
  return `+9180${ts}${String(seq++).padStart(3, '0')}`.slice(0, 13);
}

interface Paginated<T> { items: T[]; total: number }
interface Product { id: string; name: string }

async function apiPost<T = unknown>(
  req: import('@playwright/test').APIRequestContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await req.post(`${API}${path}`, { data: body });
  const json = await res.json();
  if (!res.ok()) throw new Error(`POST ${path} failed ${res.status()}: ${JSON.stringify(json)}`);
  return (json.data ?? json) as T;
}

async function apiGet<T = unknown>(
  req: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<T> {
  const res = await req.get(`${API}${path}`);
  const json = await res.json();
  if (!res.ok()) throw new Error(`GET ${path} failed ${res.status()}: ${JSON.stringify(json)}`);
  return (json.data ?? json) as T;
}

// Temp file to store the pending vendor's auth session
const SESSION_PATH = path.join(os.tmpdir(), 'buildmart-pending-vendor-session.json');

test.describe('Pending vendor — read-only dashboard access', () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ browser }) => {
    const pendingPhone = freshPhone();

    // Use a dedicated browser context for API calls so auth cookies persist within it.
    // The shared `request` fixture has no cookie jar tied to send-otp/verify-otp calls.
    const apiCtx = await browser.newContext();
    try {
      // Register the user (creates a PENDING role account)
      await apiCtx.request.post(`${API}/api/v1/auth/send-otp`, { data: { phone: pendingPhone } });
      await apiCtx.request.post(`${API}/api/v1/auth/verify-otp`, { data: { phone: pendingPhone, otp: E2E_OTP } });

      // Get a product to use in onboarding
      const products = await apiGet<Paginated<Product>>(apiCtx.request, '/api/v1/products?limit=1&offset=0');
      expect(products.items.length).toBeGreaterThan(0);

      // Submit vendor onboarding — role stays PENDING, hasVendorProfile becomes true
      // GST regex: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
      // 2 digits + 5 letters + 4 digits + 1 letter + 1 (1-9/A-Z) + Z + 1 alphanumeric = 15 chars
      // e.g. 36AABCD1234F1Z5 = 2+5+4+1+1+1+1 = 15 ✓
      const gstTs = Date.now().toString().slice(-4); // 4 digits
      const gstNumber = `36AABCD${gstTs}F1Z5`;
      await apiPost(apiCtx.request, '/api/v1/vendors/onboard', {
        businessName: 'Pending Test Builders',
        gstNumber,
        city: 'Hyderabad',
        serviceableAreas: ['Gachibowli'],
        productIds: [products.items[0].id],
      });
    } finally {
      await apiCtx.close();
    }

    // Log in once via browser UI and save the auth session cookie.
    // Use a fresh context so the UI login gets its own cookie jar.
    const loginCtx = await browser.newContext();
    const loginPage = await loginCtx.newPage();
    await loginPage.goto('/login');
    await expect(loginPage.locator('input#phone')).toBeVisible();
    await loginPage.fill('input#phone', pendingPhone);
    await loginPage.getByRole('button', { name: /get otp/i }).click();
    await expect(loginPage.locator('input#otp')).toBeVisible({ timeout: 20_000 });
    await loginPage.fill('input#otp', E2E_OTP);
    await loginPage.getByRole('button', { name: /verify otp/i }).click();
    await expect(loginPage).toHaveURL(/\/vendor\/dashboard/, { timeout: 25_000 });

    // Save auth state for reuse in individual tests
    await loginCtx.storageState({ path: SESSION_PATH });
    await loginCtx.close();
  });

  // Helper: open a new page with the pending vendor's saved session
  async function openAsVendor(browser: import('@playwright/test').Browser) {
    const ctx = await browser.newContext({ storageState: SESSION_PATH });
    const page = await ctx.newPage();
    return { page, ctx };
  }

  test('pending vendor lands on /vendor/dashboard (not /onboarding)', async ({ browser }) => {
    const { page, ctx } = await openAsVendor(browser);
    try {
      await page.goto('/vendor/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/vendor\/dashboard/, { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  test('pending vendor sees yellow approval-pending banner on dashboard', async ({ browser }) => {
    const { page, ctx } = await openAsVendor(browser);
    try {
      await page.goto('/vendor/dashboard');
      await page.waitForLoadState('networkidle');

      // Use .first() because the page renders "pending approval" text in multiple places
      // (e.g. banner paragraph + sidebar status pill)
      const banner = page.getByText(/pending approval/i).first();
      await expect(banner).toBeVisible({ timeout: 10_000 });

      const bannerText = page.getByText(/won.*t be able to submit quotes|submit quotes.*until/i);
      await expect(bannerText).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('pending vendor can navigate to all vendor pages without being blocked', async ({ browser }) => {
    const { page, ctx } = await openAsVendor(browser);
    try {
      const pages = [
        '/vendor/rfq',
        '/vendor/rfq/all',
        '/vendor/orders',
        '/vendor/analytics',
      ];

      for (const url of pages) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
        await expect(page).not.toHaveURL(/\/onboarding/, { timeout: 5_000 });
      }
    } finally {
      await ctx.close();
    }
  });

  test('pending vendor cannot access /buyer or /admin routes', async ({ browser }) => {
    // Middleware: PENDING+hasVendorProfile → only /vendor/* allowed.
    // /buyer requires BUYER or ADMIN; /admin requires ADMIN only.
    const { page, ctx } = await openAsVendor(browser);
    try {
      await page.goto('/buyer/dashboard');
      await expect(page).not.toHaveURL(/\/buyer\/dashboard/, { timeout: 10_000 });

      await page.goto('/admin/dashboard');
      await expect(page).not.toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
