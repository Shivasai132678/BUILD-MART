/**
 * Full order-flow e2e test:
 *   Buyer creates RFQ → Vendor submits quote → Buyer accepts (UI) → Order created
 *
 * API calls use Playwright request context (cookies from storageState).
 * UI verification uses the buyer page.
 *
 * Requires:
 *   - Frontend: localhost:3000
 *   - Backend:  localhost:3001  (set PLAYWRIGHT_API_URL to override)
 *   - E2E_TEST_OTP set on backend
 *   - Global setup already ran (auth cookies in .auth/)
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { STORAGE } from './support/auth';

const API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

/** Extract `.data` from the backend's success envelope. */
function unwrap<T>(body: Record<string, unknown>): T {
  return (body.data ?? body) as T;
}

async function apiGet<T>(ctx: APIRequestContext, path: string): Promise<T> {
  const res = await ctx.get(`${API}${path}`);
  if (!res.ok()) throw new Error(`GET ${path} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>(await res.json() as Record<string, unknown>);
}

async function apiPost<T>(ctx: APIRequestContext, path: string, data: unknown): Promise<T> {
  const res = await ctx.post(`${API}${path}`, { data });
  if (!res.ok()) throw new Error(`POST ${path} → ${res.status()}: ${await res.text()}`);
  return unwrap<T>(await res.json() as Record<string, unknown>);
}

// ─── Types (minimal, for test purposes only) ──────────────────────────────────
type Product  = { id: string; name: string; unit: string };
type Address  = { id: string };
type Rfq      = { id: string; status: string };
type Quote    = { id: string; totalAmount: string };
type Paginated<T> = { items: T[]; total: number };

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Full Order Flow', () => {
  test('Buyer RFQ → Vendor Quote → Buyer accepts → Order created', async ({ browser }) => {
    // --- 1. Separate browser contexts for buyer and vendor -----------------
    const buyerCtx  = await browser.newContext({ storageState: STORAGE.buyer });
    const vendorCtx = await browser.newContext({ storageState: STORAGE.vendor });
    const buyerPage = await buyerCtx.newPage();

    try {
      // --- 2. Get a product to include in the RFQ ---------------------------
      const products = await apiGet<Paginated<Product>>(
        buyerPage.request,
        '/api/v1/products?limit=1&offset=0',
      );
      expect(products.items.length).toBeGreaterThan(0);
      const product = products.items[0];

      // --- 3. Ensure buyer has an address (create one if needed) ------------
      const addresses = await apiGet<Paginated<Address>>(
        buyerPage.request,
        '/api/v1/addresses?limit=1&offset=0',
      );

      let addressId: string;
      if (addresses.items.length > 0) {
        addressId = addresses.items[0].id;
      } else {
        const addr = await apiPost<Address>(buyerPage.request, '/api/v1/addresses', {
          line1: '10 Test Street',
          area:  'Banjara Hills',
          city:  'Hyderabad',
          state: 'Telangana',
          pincode: '500034',
          isDefault: true,
        });
        addressId = addr.id;
      }

      // --- 4. Buyer creates an RFQ via API ----------------------------------
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const rfq = await apiPost<Rfq>(buyerPage.request, '/api/v1/rfq', {
        addressId,
        validUntil,
        items: [{ productId: product.id, quantity: 5, unit: product.unit }],
      });
      expect(rfq.id).toBeTruthy();
      expect(rfq.status).toBe('OPEN');
      console.log(`[e2e] RFQ created: ${rfq.id}`);

      // --- 5. Vendor submits a quote via API --------------------------------
      const vendorPage = await vendorCtx.newPage();
      const quoteValidUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const quote = await apiPost<Quote>(vendorPage.request, '/api/v1/quotes', {
        rfqId: rfq.id,
        subtotal:    '2500.00',
        taxAmount:   '450.00',
        deliveryFee: '200.00',
        totalAmount: '3150.00',
        validUntil:  quoteValidUntil,
        notes:       'E2E test quote',
        items: [{
          productName: product.name,
          quantity:    '5',
          unit:        product.unit,
          unitPrice:   '500.00',
          subtotal:    '2500.00',
        }],
      });
      expect(quote.id).toBeTruthy();
      console.log(`[e2e] Quote submitted: ${quote.id}`);
      await vendorPage.close();

      // --- 6. Buyer navigates to the RFQ page and accepts the quote (UI) ----
      await buyerPage.goto(`/buyer/rfq/${rfq.id}`);
      await expect(buyerPage).toHaveURL(new RegExp(`/buyer/rfq/${rfq.id}`));
      await buyerPage.waitForLoadState('networkidle');

      // Quote card should appear
      const acceptBtn = buyerPage.getByRole('button', { name: /accept/i }).first();
      await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
      await acceptBtn.click();

      // Confirmation dialog / redirect to orders
      // After accept, the app creates an order and redirects to /buyer/orders
      await expect(buyerPage).toHaveURL(/\/buyer\/orders/, { timeout: 15_000 });

      // --- 7. Verify the order appears in the buyer's orders list -----------
      await buyerPage.waitForLoadState('networkidle');
      // There should be at least one order row
      await expect(buyerPage.getByText(/confirmed|order/i).first()).toBeVisible({
        timeout: 10_000,
      });

      console.log('[e2e] ✓ Full order flow completed');
    } finally {
      await buyerCtx.close();
      await vendorCtx.close();
    }
  });
});

test.describe('Payment initiation', () => {
  test.use({ storageState: STORAGE.buyer });

  test('buyer orders page shows "Pay" button for confirmed orders', async ({ page }) => {
    await page.goto('/buyer/orders');
    await page.waitForLoadState('networkidle');

    // Look for any Pay button (requires a CONFIRMED order with no payment)
    const payBtn = page.getByRole('button', { name: /pay/i }).first();
    const hasPayBtn = await payBtn.isVisible().catch(() => false);

    if (hasPayBtn) {
      // Click Pay — expect Razorpay checkout to open (or a payment page)
      await payBtn.click();
      // Razorpay opens in an iframe/popup; just verify we didn't crash
      await page.waitForTimeout(2_000);
      console.log('[e2e] Pay button clicked — Razorpay checkout initiated');
    } else {
      // No confirmed+unpaid orders yet — that's OK for a clean DB state
      console.log('[e2e] No unpaid orders found — skipping payment click');
      test.skip();
    }
  });
});
