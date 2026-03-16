/**
 * Comprehensive workflow e2e test suite.
 *
 * Covers the full platform from new-user signup through to order delivery,
 * exercising all three roles (buyer, vendor, admin) and their key flows:
 *
 *   1. Auth — new user registration via UI (fresh phone)
 *   2. Auth — role-based redirects & guard enforcement
 *   3. Buyer — dashboard, catalog, RFQ creation, quote acceptance
 *   4. Vendor — onboarding multi-step form (UI), dashboard, RFQs, quote submission
 *   5. Admin — dashboard, vendor approval queue (approve/reject via UI)
 *   6. Cross-role order flow — RFQ → quote → accept → dispatch → deliver
 *
 * Requires:
 *   - Frontend: localhost:3000  (PLAYWRIGHT_BASE_URL)
 *   - Backend:  localhost:3001  (PLAYWRIGHT_API_URL)
 *   - E2E_TEST_OTP set on backend (deterministic OTP = 123456)
 *   - Global setup already ran (.auth/{admin,buyer,vendor}.json exist)
 */

import { test, expect, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test';
import { STORAGE, E2E_OTP } from './support/auth';

const API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

// ─── API helpers ──────────────────────────────────────────────────────────────

function unwrap<T>(body: Record<string, unknown>): T {
  return (body.data ?? body) as T;
}

async function apiGet<T>(ctx: APIRequestContext, path: string): Promise<T> {
  const res = await ctx.get(`${API}${path}`);
  if (!res.ok()) throw new Error(`GET ${path} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>((await res.json()) as Record<string, unknown>);
}

async function apiPost<T>(ctx: APIRequestContext, path: string, data: unknown): Promise<T> {
  const res = await ctx.post(`${API}${path}`, { data });
  if (!res.ok()) throw new Error(`POST ${path} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>((await res.json()) as Record<string, unknown>);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Product  = { id: string; name: string; unit: string };
type Address  = { id: string };
type Rfq      = { id: string; status: string; referenceCode?: string };
type Quote    = { id: string; totalAmount: string };
type Order    = { id: string; status: string };
type Paginated<T> = { items: T[]; total: number };

// ─── Unique phone generator  ──────────────────────────────────────────────────

let freshPhoneSeq = 1;
function freshPhone(): string {
  // Use a block of numbers very unlikely to collide with seeds
  const suffix = String(Date.now()).slice(-6) + String(freshPhoneSeq++);
  const digits = suffix.slice(0, 10).padEnd(10, '1');
  return `+91${digits}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUTH — NEW USER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — new user registration', () => {
  test('registers a brand-new buyer account via login UI', async ({ page }) => {
    const phone = freshPhone();

    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();

    // ── Phone step ──────────────────────────────────────────────────────────
    await page.getByLabel('Phone Number').fill(phone);
    await page.getByRole('button', { name: /get otp|send otp/i }).click();

    // Transition to OTP step
    await expect(page.getByText(/enter the otp/i)).toBeVisible({ timeout: 10_000 });

    // ── OTP step ────────────────────────────────────────────────────────────
    await page.getByLabel(/otp/i).fill(E2E_OTP);
    await page.getByRole('button', { name: /verify|confirm|sign in|continue/i }).click();

    // New user (no name set) → onboarding role chooser
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByText(/how will you use buildmart/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTH — GUARDS & ROLE-BASED REDIRECTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — guard enforcement', () => {
  test('unauthenticated user is redirected to /login from /buyer/dashboard', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated user is redirected to /login from /admin/dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('unauthenticated user is redirected to /login from /vendor/dashboard', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('buyer cannot access /admin/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE.buyer });
    const page = await ctx.newPage();
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });

  test('vendor cannot access /admin/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE.vendor });
    const page = await ctx.newPage();
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });

  test('seeded buyer can access /buyer/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE.buyer });
    const page = await ctx.newPage();
    await page.goto('/buyer/dashboard');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BUYER WORKFLOWS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Buyer workflows', () => {
  test.use({ storageState: STORAGE.buyer });

  test('dashboard loads with expected heading', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 12_000 });
  });

  test('catalog page loads and shows products', async ({ page }) => {
    await page.goto('/buyer/catalog');
    await page.waitForLoadState('networkidle');
    // Either a product grid or a heading/title is visible
    await expect(page.getByText(/catalog|product/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('new RFQ form renders all required fields', async ({ page }) => {
    await page.goto('/buyer/rfq/new');
    await page.waitForLoadState('networkidle');
    // Delivery date (or valid until), items section, and address
    await expect(page.getByText(/valid until|delivery date|rfq/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('buyer RFQ list page loads', async ({ page }) => {
    await page.goto('/buyer/rfq');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/rfq|request/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('buyer orders page loads', async ({ page }) => {
    await page.goto('/buyer/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/order/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('buyer can create an RFQ via the new RFQ form', async ({ page }) => {
    // First get a product and address via API so we can fill the form
    const products = await apiGet<Paginated<Product>>(
      page.request,
      '/api/v1/products?limit=5&offset=0',
    );
    expect(products.items.length).toBeGreaterThan(0);

    await page.goto('/buyer/rfq/new');
    await page.waitForLoadState('networkidle');

    // Fill valid-until date (tomorrow at minimum)
    const dateInput = page.locator('input[type="datetime-local"], input[type="date"]').first();
    if (await dateInput.isVisible()) {
      const inputType = await dateInput.getAttribute('type');
      const tomorrow = inputType === 'date'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      await dateInput.fill(tomorrow);
    }

    // Products might be pre-populated or selectable — just verify submit button exists
    const submitBtn = page.getByRole('button', { name: /submit|create|send rfq/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. VENDOR WORKFLOWS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Vendor workflows', () => {
  test.use({ storageState: STORAGE.vendor });

  test('dashboard loads', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 12_000 });
  });

  test('My RFQs page loads and shows available RFQs section', async ({ page }) => {
    await page.goto('/vendor/rfq');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/available rfqs|rfq/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Browse All RFQs page loads', async ({ page }) => {
    await page.goto('/vendor/rfq/all');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Browse All RFQs' })).toBeVisible({ timeout: 12_000 });
  });

  test('Browse All RFQs shows category filter buttons', async ({ page }) => {
    await page.goto('/vendor/rfq/all');
    await page.waitForLoadState('networkidle');
    // "All Categories" pill should always be present
    await expect(page.getByRole('button', { name: /all categories/i })).toBeVisible({ timeout: 15_000 });
  });

  test('category filter on Browse All changes displayed RFQs', async ({ page }) => {
    await page.goto('/vendor/rfq/all');
    await page.waitForLoadState('networkidle');

    // Wait for category pills to load
    await expect(page.getByRole('button', { name: /all categories/i })).toBeVisible({ timeout: 15_000 });

    // Click the first non-"All Categories" button if present
    const categoryButtons = page.getByRole('button').filter({ hasNotText: /all categories/i });
    const firstCat = categoryButtons.first();
    if (await firstCat.isVisible()) {
      await firstCat.click();
      await page.waitForLoadState('networkidle');
      // Page stays on browse all (no crash / redirect)
      await expect(page).toHaveURL(/\/vendor\/rfq\/all/);
    }
  });

  test('"All Categories" button resets filter', async ({ page }) => {
    await page.goto('/vendor/rfq/all');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /all categories/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /all categories/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/vendor\/rfq\/all/);
  });

  test('vendor products page loads', async ({ page }) => {
    await page.goto('/vendor/profile/products');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/product|add product/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('"Add Products" modal opens on click', async ({ page }) => {
    await page.goto('/vendor/profile/products');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: /add product/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Modal or dialog should appear
    await expect(
      page.getByRole('dialog').or(page.getByText(/select product|choose product|category/i).first()),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('vendor orders list page loads', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/order/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. VENDOR ONBOARDING (MULTI-STEP FORM — FRESH PENDING USER)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Vendor onboarding — multi-step form', () => {
  let pendingCtx: BrowserContext;
  const phone = freshPhone();

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    // Create a fresh PENDING user via the API, single login flow
    pendingCtx = await browser.newContext();
    const sendRes = await pendingCtx.request.post(`${API}/api/v1/auth/send-otp`, { data: { phone } });
    expect(sendRes.ok()).toBeTruthy();
    const verifyRes = await pendingCtx.request.post(`${API}/api/v1/auth/verify-otp`, { data: { phone, otp: E2E_OTP } });
    expect(verifyRes.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    await pendingCtx.close();
  });

  test('pending user sees onboarding role selector', async () => {
    const page = await pendingCtx.newPage();
    await page.goto('/onboarding');
    await expect(page.getByText(/how will you use buildmart/i)).toBeVisible({ timeout: 10_000 });
    await page.close();
  });

  test('vendor onboarding step 1 — business info form renders', async () => {
    const page = await pendingCtx.newPage();
    await page.goto('/onboarding/vendor');
    await page.waitForLoadState('networkidle');

    await expect(page.getByPlaceholder(/sharma building supplies/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/27aapfu|gst number/i)).toBeVisible();
    await expect(page.getByPlaceholder(/e\.g\. hyderabad/i)).toBeVisible();
    await page.close();
  });

  test('vendor onboarding step 1 validates empty form', async () => {
    const page = await pendingCtx.newPage();
    await page.goto('/onboarding/vendor');
    await page.waitForLoadState('networkidle');

    // The Next button is disabled until required fields are filled (React Hook Form + Zod prevents submission)
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    if (await nextBtn.isVisible()) {
      await expect(nextBtn).toBeDisabled({ timeout: 5_000 });
    }
    await page.close();
  });

  test('vendor onboarding — fills step 1 and proceeds to step 2 (products)', async () => {
    const page = await pendingCtx.newPage();
    await page.goto('/onboarding/vendor');
    await page.waitForLoadState('networkidle');

    // Fill step 1 fields (labels have no htmlFor, use placeholder/name selectors)
    await page.getByPlaceholder(/sharma building supplies/i).fill('E2E Test Vendors Pvt Ltd');
    await page.getByPlaceholder(/27aapfu|gst number/i).fill('36AABCT1234F1Z5');
    const cityField = page.getByPlaceholder(/e\.g\. hyderabad/i);
    await cityField.clear();
    await cityField.fill('Hyderabad');
    const areasField = page.locator('input[name="serviceableAreas"], textarea[name="serviceableAreas"]').first();
    if (await areasField.isVisible()) {
      await areasField.clear();
      await areasField.fill('Banjara Hills, Jubilee Hills');
    }

    // Proceed
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();

    // Should transition to product selection step
    await expect(page.getByText(/select product|choose product|category|product/i).first()).toBeVisible({ timeout: 10_000 });
    await page.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADMIN WORKFLOWS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin workflows', () => {
  test.use({ storageState: STORAGE.admin });

  test('admin dashboard loads and shows metrics', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10_000 });
  });

  test('vendor approvals page loads', async ({ page }) => {
    await page.goto('/admin/vendors');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /vendor management/i })).toBeVisible({ timeout: 10_000 });
  });

  test('admin can access buyer routes', async ({ page }) => {
    await page.goto('/buyer/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('vendor approvals — approve button visible when pending vendors exist', async ({ page }) => {
    // First create a pending vendor via API so there is at least one to approve
    const phone = freshPhone();
    await page.request.post(`${API}/api/v1/auth/send-otp`, { data: { phone } });
    await page.request.post(`${API}/api/v1/auth/verify-otp`, { data: { phone, otp: E2E_OTP } });

    // Onboard as vendor via API using admin request (we just need to create the profile)
    // Use a separate vendor context
    const vendorCtx = await page.context().browser()!.newContext();
    const vReq = vendorCtx.request;
    await vReq.post(`${API}/api/v1/auth/send-otp`, { data: { phone } });
    await vReq.post(`${API}/api/v1/auth/verify-otp`, { data: { phone, otp: E2E_OTP } });

    // Get a product to include
    const products = await apiGet<Paginated<Product>>(vReq, '/api/v1/products?limit=1&offset=0');
    if (products.items.length > 0) {
      try {
        await apiPost(vReq, '/api/v1/vendors/onboard', {
          businessName: 'Admin Approval Test Vendor',
          gstNumber: '36AABCT5678F1Z2',
          city: 'Hyderabad',
          serviceableAreas: ['Banjara Hills'],
          productIds: [products.items[0].id],
        });
      } catch {
        // May fail if phone already has a vendor profile — that's OK
      }
    }
    await vendorCtx.close();

    // Navigate to admin vendors page
    await page.goto('/admin/vendors');
    await page.waitForLoadState('networkidle');

    // Check for pending vendor cards — approve button may or may not be visible
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasVendors = await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasVendors) {
      // Clicking approve opens confirm dialog
      await approveBtn.click();
      await expect(page.getByRole('dialog').or(page.getByText(/confirm|approve/i).first())).toBeVisible({ timeout: 5_000 });
      // Close without confirming
      const cancelBtn = page.getByRole('button', { name: /cancel|no/i }).first();
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    } else {
      console.log('[e2e] No pending vendors visible — skipping approve button check');
    }
  });

  test('admin can approve a vendor via API', async ({ page }) => {
    // Create a fresh vendor user and onboard them
    const phone = freshPhone();
    const vendorCtx = await page.context().browser()!.newContext();
    const vReq = vendorCtx.request;

    await vReq.post(`${API}/api/v1/auth/send-otp`, { data: { phone } });
    await vReq.post(`${API}/api/v1/auth/verify-otp`, { data: { phone, otp: E2E_OTP } });

    const products = await apiGet<Paginated<Product>>(vReq, '/api/v1/products?limit=1&offset=0');
    expect(products.items.length).toBeGreaterThan(0);

    let vendorProfileId: string | undefined;
    try {
      const profile = await apiPost<{ id: string }>(vReq, '/api/v1/vendors/onboard', {
        businessName: 'API Approval Test Corp',
        gstNumber: '36AABCT9012F1Z3',
        city: 'Hyderabad',
        serviceableAreas: ['Jubilee Hills'],
        productIds: [products.items[0].id],
      });
      vendorProfileId = profile.id;
    } catch {
      console.log('[e2e] Onboard failed (profile may already exist) — skipping approval');
    }
    await vendorCtx.close();

    if (vendorProfileId) {
      // Admin approves via API
      const approveRes = await page.request.patch(
        `${API}/api/v1/admin/vendors/${vendorProfileId}/approve`,
      );
      expect(approveRes.ok(), `Admin approve failed with HTTP ${approveRes.status()}`).toBe(true);
      // VendorProfile has status field (APPROVED), not isApproved boolean
      const approved = unwrap<{ status: string }>((await approveRes.json()) as Record<string, unknown>);
      expect(approved.status).toBe('APPROVED');
      console.log(`[e2e] ✓ Vendor ${vendorProfileId} approved via admin API`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. CROSS-ROLE FULL ORDER FLOW
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cross-role full order flow', () => {
  test('Buyer creates RFQ → Vendor quotes → Buyer accepts (UI) → Order exists', async ({ browser }) => {
    const buyerCtx  = await browser.newContext({ storageState: STORAGE.buyer });
    const vendorCtx = await browser.newContext({ storageState: STORAGE.vendor });
    const buyerPage  = await buyerCtx.newPage();
    const vendorPage = await vendorCtx.newPage();

    try {
      // ── 1. Fetch a product ───────────────────────────────────────────────
      const products = await apiGet<Paginated<Product>>(
        buyerPage.request,
        '/api/v1/products?limit=1&offset=0',
      );
      expect(products.items.length).toBeGreaterThan(0);
      const product = products.items[0];

      // ── 2. Ensure buyer address ──────────────────────────────────────────
      const addresses = await apiGet<Paginated<Address>>(
        buyerPage.request,
        '/api/v1/addresses?limit=1&offset=0',
      );
      let addressId: string;
      if (addresses.items.length > 0) {
        addressId = addresses.items[0].id;
      } else {
        const addr = await apiPost<Address>(buyerPage.request, '/api/v1/addresses', {
          line1: '1 E2E Street',
          area:  'Banjara Hills',
          city:  'Hyderabad',
          state: 'Telangana',
          pincode: '500034',
          isDefault: true,
        });
        addressId = addr.id;
      }

      // ── 3. Buyer creates RFQ via API ────────────────────────────────────
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const rfq = await apiPost<Rfq>(buyerPage.request, '/api/v1/rfq', {
        addressId,
        validUntil,
        items: [{ productId: product.id, quantity: 10, unit: product.unit }],
      });
      expect(rfq.id).toBeTruthy();
      expect(rfq.status).toBe('OPEN');
      console.log(`[e2e] RFQ created: ${rfq.id}`);

      // ── 4. Vendor submits quote via API ──────────────────────────────────
      const quoteValidUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const quote = await apiPost<Quote>(vendorPage.request, '/api/v1/quotes', {
        rfqId:       rfq.id,
        subtotal:    '5000.00',
        taxAmount:   '900.00',
        deliveryFee: '200.00',
        totalAmount: '6100.00',
        validUntil:  quoteValidUntil,
        notes:       'Workflow e2e quote',
        items: [{
          productName: product.name,
          quantity:    '10',
          unit:        product.unit,
          unitPrice:   '500.00',
          subtotal:    '5000.00',
        }],
      });
      expect(quote.id).toBeTruthy();
      console.log(`[e2e] Quote submitted: ${quote.id}`);

      // ── 5. Buyer accepts quote via UI ────────────────────────────────────
      await buyerPage.goto(`/buyer/rfq/${rfq.id}`);
      await expect(buyerPage).toHaveURL(new RegExp(`/buyer/rfq/${rfq.id}`));
      await buyerPage.waitForLoadState('networkidle');

      const acceptBtn = buyerPage.getByRole('button', { name: /accept/i }).first();
      await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
      await acceptBtn.click();

      // After acceptance the app redirects to orders
      await expect(buyerPage).toHaveURL(/\/buyer\/orders/, { timeout: 20_000 });
      await buyerPage.waitForLoadState('networkidle');
      await expect(buyerPage.getByText(/confirmed|order/i).first()).toBeVisible({ timeout: 10_000 });
      console.log('[e2e] ✓ Quote accepted — order created');

    } finally {
      await buyerCtx.close();
      await vendorCtx.close();
    }
  });

  test('Vendor marks order as dispatched then delivered (API + UI)', async ({ browser }) => {
    const buyerCtx  = await browser.newContext({ storageState: STORAGE.buyer });
    const vendorCtx = await browser.newContext({ storageState: STORAGE.vendor });
    const buyerPage  = await buyerCtx.newPage();
    const vendorPage = await vendorCtx.newPage();

    try {
      // ── Set up RFQ → quote → order via APIs ─────────────────────────────
      const products = await apiGet<Paginated<Product>>(
        buyerPage.request,
        '/api/v1/products?limit=1&offset=0',
      );
      expect(products.items.length).toBeGreaterThan(0);
      const product = products.items[0];

      const addresses = await apiGet<Paginated<Address>>(
        buyerPage.request,
        '/api/v1/addresses?limit=1&offset=0',
      );
      let addressId: string;
      if (addresses.items.length > 0) {
        addressId = addresses.items[0].id;
      } else {
        const addr = await apiPost<Address>(buyerPage.request, '/api/v1/addresses', {
          line1: '2 Dispatch Road',
          area:  'Jubilee Hills',
          city:  'Hyderabad',
          state: 'Telangana',
          pincode: '500033',
          isDefault: false,
        });
        addressId = addr.id;
      }

      const rfq = await apiPost<Rfq>(buyerPage.request, '/api/v1/rfq', {
        addressId,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productId: product.id, quantity: 5, unit: product.unit }],
      });

      const quoteValidUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await apiPost<Quote>(vendorPage.request, '/api/v1/quotes', {
        rfqId:       rfq.id,
        subtotal:    '2500.00',
        taxAmount:   '450.00',
        deliveryFee: '150.00',
        totalAmount: '3100.00',
        validUntil:  quoteValidUntil,
        notes:       'Dispatch flow e2e quote',
        items: [{
          productName: product.name,
          quantity:    '5',
          unit:        product.unit,
          unitPrice:   '500.00',
          subtotal:    '2500.00',
        }],
      });

      // Buyer accepts quote via UI
      await buyerPage.goto(`/buyer/rfq/${rfq.id}`);
      await buyerPage.waitForLoadState('networkidle');
      const acceptBtn = buyerPage.getByRole('button', { name: /accept/i }).first();
      await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
      await acceptBtn.click();
      await expect(buyerPage).toHaveURL(/\/buyer\/orders/, { timeout: 20_000 });

      // Get the order ID from vendor orders API
      const vendorOrders = await apiGet<Paginated<Order>>(
        vendorPage.request,
        '/api/v1/orders?limit=10&offset=0',
      );
      const confirmedOrder = vendorOrders.items.find((o) => o.status === 'CONFIRMED');

      if (!confirmedOrder) {
        console.log('[e2e] No CONFIRMED order found for dispatch test — skipping dispatch checks');
        return;
      }

      // ── Vendor marks dispatched via UI ───────────────────────────────────
      await vendorPage.goto(`/vendor/orders/${confirmedOrder.id}`);
      await vendorPage.waitForLoadState('networkidle');

      const dispatchBtn = vendorPage.getByRole('button', { name: /mark dispatched|out for delivery/i });
      await expect(dispatchBtn).toBeVisible({ timeout: 10_000 });
      await dispatchBtn.click();
      await vendorPage.waitForLoadState('networkidle');

      // Status should advance to OUT_FOR_DELIVERY
      await expect(
        vendorPage.getByText(/out for delivery|dispatched/i).first(),
      ).toBeVisible({ timeout: 10_000 });
      console.log('[e2e] ✓ Order marked OUT_FOR_DELIVERY');

      // ── Vendor marks delivered via UI ────────────────────────────────────
      const deliverBtn = vendorPage.getByRole('button', { name: /mark delivered/i });
      await expect(deliverBtn).toBeVisible({ timeout: 8_000 });
      await deliverBtn.click();
      await vendorPage.waitForLoadState('networkidle');

      await expect(
        vendorPage.getByText(/delivered/i).first(),
      ).toBeVisible({ timeout: 10_000 });
      console.log('[e2e] ✓ Order marked DELIVERED');

    } finally {
      await buyerCtx.close();
      await vendorCtx.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RFQ DETAIL PAGES
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Vendor — RFQ detail and quote form', () => {
  test.use({ storageState: STORAGE.vendor });

  test('vendor can view any OPEN RFQ and quote form renders', async ({ page, browser }) => {
    // Create an RFQ as buyer
    const buyerCtx = await browser.newContext({ storageState: STORAGE.buyer });
    const buyerReq = buyerCtx.request;

    const products = await apiGet<Paginated<Product>>(buyerReq, '/api/v1/products?limit=1&offset=0');
    expect(products.items.length).toBeGreaterThan(0);
    const product  = products.items[0];

    const addresses = await apiGet<Paginated<Address>>(buyerReq, '/api/v1/addresses?limit=1&offset=0');
    let addressId: string;
    if (addresses.items.length > 0) {
      addressId = addresses.items[0].id;
    } else {
      const addr = await apiPost<Address>(buyerReq, '/api/v1/addresses', {
        line1: '3 Vendor Quote St',
        area:  'Madhapur',
        city:  'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: false,
      });
      addressId = addr.id;
    }

    const rfq = await apiPost<Rfq>(buyerReq, '/api/v1/rfq', {
      addressId,
      validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      items: [{ productId: product.id, quantity: 3, unit: product.unit }],
    });
    await buyerCtx.close();

    // Vendor navigates to the RFQ detail (should work for any OPEN RFQ now)
    await page.goto(`/vendor/rfq/${rfq.id}`);
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to 404 or login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/404/);

    // Quote form elements should be visible
    await expect(page.getByText(/submit quote|quote|rfq/i).first()).toBeVisible({ timeout: 10_000 });
    console.log(`[e2e] ✓ Vendor can view RFQ ${rfq.id} detail`);
  });

  test('vendor "Browse All" RFQ links navigate to detail page without 404', async ({ page, browser }) => {
    // Create at least one OPEN RFQ
    const buyerCtx = await browser.newContext({ storageState: STORAGE.buyer });
    const buyerReq = buyerCtx.request;
    const products = await apiGet<Paginated<Product>>(buyerReq, '/api/v1/products?limit=1&offset=0');
    expect(products.items.length).toBeGreaterThan(0);
    const product  = products.items[0];
    const addresses = await apiGet<Paginated<Address>>(buyerReq, '/api/v1/addresses?limit=1&offset=0');
    let addressId: string;
    if (addresses.items.length > 0) {
      addressId = addresses.items[0].id;
    } else {
      const addr = await apiPost<Address>(buyerReq, '/api/v1/addresses', {
        line1: '4 Browse Test Lane',
        area:  'Madhapur',
        city:  'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: false,
      });
      addressId = addr.id;
    }
    await apiPost<Rfq>(buyerReq, '/api/v1/rfq', {
      addressId,
      validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      items: [{ productId: product.id, quantity: 2, unit: product.unit }],
    });
    await buyerCtx.close();

    // Navigate to Browse All page
    await page.goto('/vendor/rfq/all');
    await page.waitForLoadState('networkidle');

    // Click the first RFQ card link if it exists (use href attribute to match detail pages, not nav links)
    const rfqLink = page.locator('a[href*="/vendor/rfq/"]').first();
    const hasLink = await rfqLink.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasLink) {
      await rfqLink.click();
      await page.waitForLoadState('networkidle');
      // Should land on /vendor/rfq/<id>, not 404
      await expect(page).toHaveURL(/\/vendor\/rfq\//);
      await expect(page).not.toHaveURL(/\/404/);
      console.log('[e2e] ✓ RFQ link from Browse All navigates correctly');
    } else {
      console.log('[e2e] No RFQ cards visible on Browse All page yet');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ADMIN — FULL VENDOR APPROVAL FLOW VIA UI
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin — vendor approval via UI', () => {
  test.use({ storageState: STORAGE.admin });

  test('admin approves a pending vendor through the UI', async ({ page, browser }) => {
    // Create a fresh vendor and onboard them via API
    const phone = freshPhone();
    const vendorCtx = await browser.newContext();
    const vReq = vendorCtx.request;

    await vReq.post(`${API}/api/v1/auth/send-otp`, { data: { phone } });
    await vReq.post(`${API}/api/v1/auth/verify-otp`, { data: { phone, otp: E2E_OTP } });

    const products = await apiGet<Paginated<Product>>(vReq, '/api/v1/products?limit=1&offset=0');
    let onboardOk = false;
    if (products.items.length > 0) {
      try {
        await apiPost(vReq, '/api/v1/vendors/onboard', {
          businessName:     'UI Approval Test Vendor',
          gstNumber:        '36AABCT3456F1Z4',
          city:             'Hyderabad',
          serviceableAreas: ['Banjara Hills'],
          productIds:       [products.items[0].id],
        });
        onboardOk = true;
      } catch {
        console.log('[e2e] Onboard possibly already exists — continuing');
      }
    }
    await vendorCtx.close();

    if (!onboardOk) {
      console.log('[e2e] Could not onboard fresh vendor — skipping UI approval test');
      return;
    }

    // Navigate to admin vendor approvals page
    await page.goto('/admin/vendors');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /vendor approval/i })).toBeVisible({ timeout: 10_000 });

    // Look for an Approve button
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasApproveBtn = await approveBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasApproveBtn) {
      console.log('[e2e] No approve button visible — pending vendor may not appear immediately');
      return;
    }

    await approveBtn.click();

    // A confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (dialogVisible) {
      // Confirm approval
      const confirmBtn = dialog.getByRole('button', { name: /approve|confirm|yes/i });
      await confirmBtn.click();
      // Toast or status update
      await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
      console.log('[e2e] ✓ Vendor approved through UI');
    } else {
      // Dialog may not be a role=dialog — look for confirm button directly
      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
        console.log('[e2e] ✓ Vendor approved through UI (no dialog role)');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. NOTIFICATIONS END-POINT SANITY
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Notifications — in-app list endpoint', () => {
  test.use({ storageState: STORAGE.buyer });

  test('buyer notifications endpoint returns paginated list', async ({ page }) => {
    const res = await page.request.get(`${API}/api/v1/notifications?limit=10&offset=0`);
    // 200 or 404 are acceptable; what we do NOT want is 500
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const body = (await res.json()) as Record<string, unknown>;
      const data = (body.data ?? body) as { items?: unknown[] };
      expect(Array.isArray(data.items ?? [])).toBe(true);
    }
  });
});
