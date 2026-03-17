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
import { E2E_OTP, STORAGE } from './support/auth';
import path from 'node:path';
import os from 'node:os';

const API = 'http://localhost:3001';

let seq = 0;
function freshPhone(): string {
  const ts = Date.now().toString().slice(-7);
  return `+9180${ts}${String(seq++).padStart(3, '0')}`.slice(0, 13);
}

const NON_ZERO_ALPHA_NUM = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHA_NUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let gstSeq = 0;
function freshGstNumber(): string {
  gstSeq += 1;
  const fourDigits = String(Date.now() + gstSeq).slice(-4);
  const checkChar = NON_ZERO_ALPHA_NUM[gstSeq % NON_ZERO_ALPHA_NUM.length];
  const tailChar = ALPHA_NUM[(gstSeq * 7) % ALPHA_NUM.length];
  return `36AABCD${fourDigits}F${checkChar}Z${tailChar}`;
}

interface Paginated<T> { items: T[]; total: number }
interface Product { id: string; name: string; unit: string }
interface Address { id: string }
interface Rfq { id: string }

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
  let pendingPhone = '';
  let pendingProduct: Product;
  let pendingRfqId = '';

  test.beforeAll(async ({ browser }) => {
    pendingPhone = freshPhone();

    // Use a dedicated browser context for API calls so auth cookies persist within it.
    // The shared `request` fixture has no cookie jar tied to send-otp/verify-otp calls.
    const apiCtx = await browser.newContext();
    try {
      // Register the user (creates a PENDING role account)
      const sendRes = await apiCtx.request.post(`${API}/api/v1/auth/send-otp`, { data: { phone: pendingPhone } });
      expect(sendRes.ok(), `send-otp failed: ${sendRes.status()} ${await sendRes.text()}`).toBe(true);
      const verifyRes = await apiCtx.request.post(`${API}/api/v1/auth/verify-otp`, { data: { phone: pendingPhone, otp: E2E_OTP } });
      expect(verifyRes.ok(), `verify-otp failed: ${verifyRes.status()} ${await verifyRes.text()}`).toBe(true);

      // Get a product to use in onboarding
      const products = await apiGet<Paginated<Product>>(apiCtx.request, '/api/v1/products?limit=1&offset=0');
      expect(products.items.length).toBeGreaterThan(0);
      pendingProduct = products.items[0];

      // Submit vendor onboarding — role stays PENDING, hasVendorProfile becomes true
      await apiPost(apiCtx.request, '/api/v1/vendors/onboard', {
        businessName: 'Pending Test Builders',
        gstNumber: freshGstNumber(),
        city: 'Hyderabad',
        serviceableAreas: ['Gachibowli'],
        productIds: [pendingProduct.id],
      });
    } finally {
      await apiCtx.close();
    }

    // Create one OPEN RFQ from a buyer session so pending vendor quote restrictions
    // can be asserted against a real RFQ detail page and quote payload.
    const buyerCtx = await browser.newContext({ storageState: STORAGE.buyer });
    try {
      const addresses = await apiGet<Paginated<Address>>(buyerCtx.request, '/api/v1/addresses?limit=1&offset=0');
      let addressId = addresses.items[0]?.id;

      if (!addressId) {
        const createdAddress = await apiPost<Address>(buyerCtx.request, '/api/v1/addresses', {
          label: 'Pending Vendor E2E Address',
          line1: '77 Buyer Street',
          area: 'Madhapur',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500081',
          isDefault: true,
        });
        addressId = createdAddress.id;
      }

      const rfq = await apiPost<Rfq>(buyerCtx.request, '/api/v1/rfq', {
        addressId,
        validUntil: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productId: pendingProduct.id, quantity: 5, unit: pendingProduct.unit }],
      });
      pendingRfqId = rfq.id;
      expect(pendingRfqId).toBeTruthy();
    } finally {
      await buyerCtx.close();
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

  test('pending vendor UI keeps quote submission and product actions disabled', async ({ browser }) => {
    const { page, ctx } = await openAsVendor(browser);
    try {
      await page.goto(`/vendor/rfq/${pendingRfqId}`);
      await page.waitForLoadState('networkidle');

      const quoteSubmitButton = page.getByRole('button', { name: /approval required|submit quote/i }).first();
      const hasSubmitControl = await quoteSubmitButton
        .isVisible({ timeout: 4_000 })
        .catch(() => false);
      if (hasSubmitControl) {
        await expect(quoteSubmitButton).toBeDisabled();
        await expect(quoteSubmitButton).toHaveText(/approval required/i);
      } else {
        await expect(page.getByText(/failed to load rfq|not allowed|unauthorized/i).first()).toBeVisible({
          timeout: 10_000,
        });
      }

      await page.goto('/vendor/profile/products');
      await page.waitForLoadState('networkidle');

      const addProductsButton = page.getByRole('button', { name: /add products?/i }).first();
      await expect(addProductsButton).toBeVisible({ timeout: 10_000 });
      await expect(addProductsButton).toBeDisabled();

      const restrictedDeleteButton = page
        .locator('button[title="Approval required to manage products"]')
        .first();
      await expect(restrictedDeleteButton).toBeVisible({ timeout: 10_000 });
      await expect(restrictedDeleteButton).toBeDisabled();
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

  test('pending vendor API mutation attempts are denied with 403', async ({ browser }) => {
    const apiCtx = await browser.newContext({ storageState: SESSION_PATH });
    try {
      const quoteRes = await apiCtx.request.post(`${API}/api/v1/quotes`, {
        data: {
          rfqId: pendingRfqId,
          subtotal: '2500.00',
          taxAmount: '450.00',
          deliveryFee: '100.00',
          totalAmount: '3050.00',
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          items: [{
            productName: pendingProduct.name,
            quantity: '5',
            unit: pendingProduct.unit,
            unitPrice: '500.00',
            subtotal: '2500.00',
          }],
        },
      });
      expect(quoteRes.status()).toBe(403);

      const addProductRes = await apiCtx.request.post(`${API}/api/v1/vendors/products`, {
        data: { productIds: [pendingProduct.id] },
      });
      expect(addProductRes.status()).toBe(403);
    } finally {
      await apiCtx.close();
    }
  });
});
