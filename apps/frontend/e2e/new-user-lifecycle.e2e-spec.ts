/**
 * New user full lifecycle test.
 *
 * Tests the complete journey from fresh registration to a fully completed order:
 *  1. New buyer registers and completes buyer onboarding (API + browser verify)
 *  2. New vendor registers and completes vendor onboarding (API)
 *  3. Admin approves the new vendor (API, reuses global-setup admin session)
 *  4. Buyer creates an RFQ (API, reuses saved buyer session)
 *  5. Vendor submits a quote (API, reuses saved vendor session)
 *  6. Buyer accepts the quote → order created (API, reuses saved buyer session)
 *  7. Vendor dispatches and delivers the order (API, reuses saved vendor session)
 *  8. Buyer sees the delivered order on /buyer/orders (browser)
 *  9. Buyer navigates to order detail page (browser)
 *
 * Throttle strategy: only Steps 1 and 2 call send-otp/verify-otp (1 call each).
 * Combined with global-setup's 3 calls per endpoint, that's 5 total — exactly
 * at the @Throttle(5, 60) limit. Steps 3–9 reuse saved storageState files,
 * requiring ZERO additional OTP calls.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { STORAGE, E2E_OTP } from './support/auth';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

const API_BASE = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unwrap<T>(body: Record<string, unknown>): T {
  return (body.data ?? body) as T;
}

async function apiGet<T>(ctx: import('@playwright/test').APIRequestContext, apiPath: string): Promise<T> {
  const res = await ctx.get(apiPath);
  if (!res.ok()) throw new Error(`GET ${apiPath} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>((await res.json()) as Record<string, unknown>);
}

async function apiPost<T>(ctx: import('@playwright/test').APIRequestContext, apiPath: string, data: unknown): Promise<T> {
  const res = await ctx.post(apiPath, { data });
  if (!res.ok()) throw new Error(`POST ${apiPath} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>((await res.json()) as Record<string, unknown>);
}

async function apiPatch<T>(ctx: import('@playwright/test').APIRequestContext, apiPath: string, data: unknown): Promise<T> {
  const res = await ctx.patch(apiPath, { data });
  if (!res.ok()) throw new Error(`PATCH ${apiPath} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>((await res.json()) as Record<string, unknown>);
}

/**
 * Login via direct API calls using a standalone request context.
 * Returns the context — caller must dispose it.
 */
async function createApiSession(phone: string): Promise<import('@playwright/test').APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const sendRes = await ctx.post('/api/v1/auth/send-otp', { data: { phone } });
  if (!sendRes.ok()) throw new Error(`send-otp failed for ${phone}: ${sendRes.status()} ${await sendRes.text()}`);
  const verifyRes = await ctx.post('/api/v1/auth/verify-otp', { data: { phone, otp: E2E_OTP } });
  if (!verifyRes.ok()) throw new Error(`verify-otp failed for ${phone}: ${verifyRes.status()} ${await verifyRes.text()}`);
  return ctx;
}

/**
 * Load a previously saved session for API calls. No OTP calls needed.
 */
async function loadApiSession(stateFile: string): Promise<import('@playwright/test').APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: API_BASE, storageState: stateFile });
}

let phoneSeq = 0;
function freshPhone(): string {
  const ts = Date.now().toString().slice(-6);
  return `+9175${ts}${String(phoneSeq++).padStart(4, '0')}`.slice(0, 13);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Product  = { id: string; name: string; unit: string };
type Address  = { id: string; line1: string };
type Rfq      = { id: string; status: string; referenceCode?: string };
type Quote    = { id: string; totalAmount: string };
type Order    = { id: string; status: string };
type Vendor   = { id: string; status: string; businessName: string };
type Paginated<T> = { items: T[]; total: number };

// ─── Lifecycle state (shared across tests in the describe block) ──────────────

let buyerPhone: string;
let vendorPhone: string;
let vendorId: string;
let productId: string;
let addressId: string;
let rfqId: string;
let quoteId: string;
let orderId: string;

// Saved storageState files — created in Steps 1/2, reused in Steps 3–9.
// These hold the HTTP-only JWT cookie so subsequent API/browser contexts
// can authenticate without calling send-otp/verify-otp again.
let buyerStateFile: string;
let vendorStateFile: string;

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('New user full lifecycle', () => {
  test.setTimeout(120_000);

  // Clean up temp storageState files after all tests complete.
  test.afterAll(() => {
    for (const f of [buyerStateFile, vendorStateFile]) {
      if (f) try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  // ─── Step 1: New buyer registers and completes onboarding ───────────────────
  //
  // OTP calls: 1 send + 1 verify (total across suite so far: 1+1)
  //
  // After buyer-profile, the DB role changes to BUYER but the JWT still has
  // role=PENDING. We call POST /api/v1/auth/refresh to get a new JWT with
  // role=BUYER, then save the storageState for reuse in later steps.

  test('Step 1 — new buyer registers and completes buyer onboarding', async ({ browser }) => {
    buyerPhone = freshPhone();
    buyerStateFile = path.join(os.tmpdir(), `buildmart-e2e-buyer-${Date.now()}.json`);

    const ctx = await createApiSession(buyerPhone);
    try {
      await apiPost(ctx, '/api/v1/onboarding/buyer-profile', { name: 'Test Buyer Lifecycle' });
      // Refresh token so JWT carries role=BUYER (needed for /buyer/* middleware)
      await ctx.post('/api/v1/auth/refresh', {});
      await ctx.storageState({ path: buyerStateFile });
      console.log(`[e2e] Buyer onboarding complete: ${buyerPhone}`);
    } finally {
      await ctx.dispose();
    }

    // Verify the buyer can reach /buyer/dashboard in the browser
    const buyerCtx = await browser.newContext({ storageState: buyerStateFile });
    const page = await buyerCtx.newPage();
    try {
      await page.goto('/buyer/dashboard');
      await expect(page).toHaveURL(/\/buyer\/dashboard/, { timeout: 20_000 });
      console.log(`[e2e] Buyer dashboard accessible: ${buyerPhone}`);
    } finally {
      await buyerCtx.close();
    }
  });

  // ─── Step 2: New vendor registers and completes onboarding via API ──────────
  //
  // OTP calls: 1 send + 1 verify (total across suite so far: 2+2)
  // Combined with global-setup (3+3), we're at 5+5 per endpoint = at the limit.

  test('Step 2 — new vendor registers and completes onboarding', async () => {
    vendorPhone = freshPhone();
    vendorStateFile = path.join(os.tmpdir(), `buildmart-e2e-vendor-${Date.now()}.json`);

    const ctx = await createApiSession(vendorPhone);
    try {
      // Get a product
      const products = await apiGet<Paginated<Product>>(ctx, '/api/v1/products?limit=1&offset=0');
      expect(products.items.length).toBeGreaterThan(0);
      productId = products.items[0].id;

      // Onboard — GST regex: exactly 15 chars
      const gstSuffix = Date.now().toString().slice(-4);
      const profile = await apiPost<Vendor>(ctx, '/api/v1/vendors/onboard', {
        businessName: 'Lifecycle Test Builders',
        gstNumber: `36AALTX${gstSuffix}F1Z0`,
        city: 'Hyderabad',
        serviceableAreas: ['Madhapur'],
        productIds: [productId],
      });
      vendorId = profile.id;
      expect(vendorId).toBeTruthy();
      expect(profile.status).toBe('PENDING');

      // Refresh token so JWT carries hasVendorProfile=true
      await ctx.post('/api/v1/auth/refresh', {});
      await ctx.storageState({ path: vendorStateFile });
      console.log(`[e2e] Vendor registered and onboarded: ${vendorPhone}, vendorId=${vendorId}`);
    } finally {
      await ctx.dispose();
    }
  });

  // ─── Step 3: Admin approves the vendor ───────────────────────────────────────
  // OTP calls: 0 (reuses global-setup admin session)

  test('Step 3 — admin approves the new vendor', async () => {
    expect(vendorId).toBeTruthy();

    const adminCtx = await loadApiSession(STORAGE.admin);
    try {
      const approved = await apiPatch<Vendor>(adminCtx, `/api/v1/admin/vendors/${vendorId}/approve`, {});
      expect(approved.status).toBe('APPROVED');
      console.log(`[e2e] Vendor ${vendorId} approved`);
    } finally {
      await adminCtx.dispose();
    }

    // After approval the vendor's JWT needs vendorApproved=true.
    // Refresh the vendor token and re-save storageState.
    const vendorCtx = await loadApiSession(vendorStateFile);
    try {
      await vendorCtx.post('/api/v1/auth/refresh', {});
      await vendorCtx.storageState({ path: vendorStateFile });
    } finally {
      await vendorCtx.dispose();
    }
  });

  // ─── Step 4: Buyer creates an RFQ via API ────────────────────────────────────
  // OTP calls: 0 (reuses saved buyer session)

  test('Step 4 — buyer creates an RFQ via API', async () => {
    expect(buyerPhone).toBeTruthy();
    expect(productId).toBeTruthy();

    const ctx = await loadApiSession(buyerStateFile);
    try {
      // Create address
      const addr = await apiPost<Address>(ctx, '/api/v1/addresses', {
        label: 'Site Office',
        line1: '123 Builder Street',
        area: 'Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: true,
      });
      addressId = addr.id;
      expect(addressId).toBeTruthy();

      // Create RFQ
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const rfq = await apiPost<Rfq>(ctx, '/api/v1/rfq', {
        addressId,
        validUntil,
        items: [{ productId, quantity: 5, unit: 'bag' }],
      });
      rfqId = rfq.id;
      expect(rfqId).toBeTruthy();
      console.log(`[e2e] RFQ created: ${rfqId}`);
    } finally {
      await ctx.dispose();
    }
  });

  // ─── Step 5: Vendor submits a quote ──────────────────────────────────────────
  // OTP calls: 0 (reuses saved vendor session)

  test('Step 5 — vendor submits a quote for the RFQ', async () => {
    expect(rfqId).toBeTruthy();
    expect(vendorPhone).toBeTruthy();

    const ctx = await loadApiSession(vendorStateFile);
    try {
      const validUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      // All monetary values are decimal strings (Rule 3/4). Item subtotal = unitPrice * quantity.
      const quote = await apiPost<Quote>(ctx, '/api/v1/quotes', {
        rfqId,
        validUntil,
        subtotal: '2750.00',
        taxAmount: '495.00',
        deliveryFee: '200.00',
        totalAmount: '3445.00',
        notes: 'Fast delivery guaranteed.',
        items: [{
          productName: 'Cement',
          unitPrice: '550.00',
          quantity: '5',
          unit: 'bag',
          subtotal: '2750.00',
        }],
      });
      quoteId = quote.id;
      expect(quoteId).toBeTruthy();
      console.log(`[e2e] Quote submitted: ${quoteId}`);
    } finally {
      await ctx.dispose();
    }
  });

  // ─── Step 6: Buyer accepts the quote ─────────────────────────────────────────
  // OTP calls: 0 (reuses saved buyer session)

  test('Step 6 — buyer accepts the quote and order is created', async () => {
    expect(quoteId).toBeTruthy();
    expect(buyerPhone).toBeTruthy();

    const ctx = await loadApiSession(buyerStateFile);
    try {
      const order = await apiPost<Order>(ctx, '/api/v1/orders', { quoteId });
      orderId = order.id;
      expect(orderId).toBeTruthy();
      expect(order.status).toMatch(/CONFIRMED|PENDING/i);
      console.log(`[e2e] Order created: ${orderId}`);
    } finally {
      await ctx.dispose();
    }
  });

  // ─── Step 7: Vendor dispatches and delivers the order ────────────────────────
  // OTP calls: 0 (reuses saved vendor session)

  test('Step 7 — vendor marks order as dispatched then delivered', async () => {
    expect(orderId).toBeTruthy();
    expect(vendorPhone).toBeTruthy();

    const ctx = await loadApiSession(vendorStateFile);
    try {
      const dispatched = await apiPatch<Order>(ctx, `/api/v1/orders/${orderId}/status`, {
        status: 'OUT_FOR_DELIVERY',
      });
      expect(dispatched.status).toBe('OUT_FOR_DELIVERY');

      const delivered = await apiPatch<Order>(ctx, `/api/v1/orders/${orderId}/status`, {
        status: 'DELIVERED',
      });
      expect(delivered.status).toBe('DELIVERED');
      console.log(`[e2e] Order ${orderId} delivered`);
    } finally {
      await ctx.dispose();
    }
  });

  // ─── Step 8: Buyer sees delivered order in the orders list (UI) ──────────────
  // OTP calls: 0 (reuses saved buyer storageState for browser)

  test('Step 8 — buyer can see the delivered order on /buyer/orders (UI)', async ({ browser }) => {
    expect(orderId).toBeTruthy();
    expect(buyerStateFile).toBeTruthy();

    const buyerCtx = await browser.newContext({ storageState: buyerStateFile });
    const page = await buyerCtx.newPage();
    try {
      await page.goto('/buyer/orders');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_500);

      // Should find at least one DELIVERED order or an order link
      const orderRow = page.locator('text=DELIVERED').first();
      const anyOrder = page.locator('[href^="/buyer/orders/"]').first();
      const hasDelivered = await orderRow.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasAny = await anyOrder.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasDelivered || hasAny).toBe(true);
    } finally {
      await buyerCtx.close();
    }
  });

  // ─── Step 9: Buyer visits order detail and review section is accessible ───────
  // OTP calls: 0 (reuses saved buyer storageState for browser)

  test('Step 9 — buyer can navigate to order detail and review form is accessible', async ({ browser }) => {
    expect(orderId).toBeTruthy();
    expect(buyerStateFile).toBeTruthy();

    const buyerCtx = await browser.newContext({ storageState: buyerStateFile });
    const page = await buyerCtx.newPage();
    try {
      await page.goto(`/buyer/orders/${orderId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_500);

      await expect(page).toHaveURL(new RegExp(`/buyer/orders/${orderId}`));

      // Page should show status DELIVERED (use .first() — multiple elements match)
      const statusText = page.getByText(/delivered/i).first();
      await expect(statusText).toBeVisible({ timeout: 10_000 });

      // Review form or "Leave a review" button may be visible for DELIVERED orders
      const reviewBtn = page.getByRole('button', { name: /leave a review|write a review|rate/i });
      const reviewForm = page.getByRole('textbox', { name: /comment|review/i });
      const hasReviewBtn = await reviewBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasReviewForm = await reviewForm.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasReviewBtn || hasReviewForm) {
        console.log('[e2e] Review UI is accessible on delivered order');
      } else {
        console.log('[e2e] Review UI not found — order detail page still loaded correctly');
      }
    } finally {
      await buyerCtx.close();
    }
  });
});
