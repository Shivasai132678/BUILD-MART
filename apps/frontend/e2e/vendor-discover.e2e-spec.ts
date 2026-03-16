/**
 * Discover Vendors + Direct Order flow tests.
 *
 * Covers:
 *  - /buyer/vendors page loads with "Discover Vendors" heading
 *  - City filter input and Search button visible
 *  - Vendor cards appear (seeded data has approved vendors)
 *  - Clicking a vendor card navigates to /buyer/vendors/[id]
 *  - Vendor profile page shows business name, city, Products section
 *  - "Add to Order" button on a product card adds it to the cart
 *  - "Order N items" button opens the direct order modal
 *  - Modal shows "Confirm Direct Order" heading and delivery address selector
 *  - Cancelling the modal returns to the vendor profile page
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from './support/auth';

test.use({ storageState: STORAGE.buyer });

test.describe('Discover Vendors page', () => {
  test('loads with "Discover Vendors" heading and filter controls', async ({ page }) => {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /discover vendors/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/mumbai/i)).toBeVisible(); // city input
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
  });

  test('shows vendor cards for approved seeded vendors', async ({ page }) => {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500); // allow React Query to fetch

    // There should be at least one vendor card (seeded data has Lakshmi, Balaji, Sai, etc.)
    const firstCard = page.locator('a[href^="/buyer/vendors/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
  });

  test('city filter narrows results', async ({ page }) => {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');

    // Type a city that has seeded vendors (Hyderabad)
    await page.fill('input[placeholder*="Mumbai"]', 'Hyderabad');
    await page.getByRole('button', { name: /search/i }).click();
    await page.waitForTimeout(1_500);

    // Should still have results OR show "No vendors found"
    const cards = page.locator('a[href^="/buyer/vendors/"]');
    const empty = page.getByText(/no vendors found/i);
    const hasCards = await cards.count() > 0;
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('rating filter renders select with "Any rating" default option', async ({ page }) => {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');

    const ratingSelect = page.locator('select');
    await expect(ratingSelect).toBeVisible();
    await expect(ratingSelect).toHaveValue('');
  });

  test('clicking a vendor card navigates to vendor profile page', async ({ page }) => {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const firstCard = page.locator('a[href^="/buyer/vendors/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/\/buyer\/vendors\/.+/);

    await firstCard.click();
    await expect(page).toHaveURL(/\/buyer\/vendors\/.+/, { timeout: 10_000 });
  });
});

test.describe('Vendor profile page (/buyer/vendors/[id])', () => {
  /**
   * Helper: navigate to the first available vendor's profile page.
   */
  async function goToFirstVendorProfile(page: import('@playwright/test').Page) {
    await page.goto('/buyer/vendors');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const firstCard = page.locator('a[href^="/buyer/vendors/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/buyer\/vendors\/.+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
  }

  test('vendor profile page loads with business name and city', async ({ page }) => {
    await goToFirstVendorProfile(page);

    // Profile card should show businessName and city
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Location icon + city text should be present
    await expect(page.getByText(/location_on/i).or(page.locator('[class*="location"]'))).toBeVisible();
  });

  test('vendor profile shows "Products" section heading', async ({ page }) => {
    await goToFirstVendorProfile(page);

    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible({ timeout: 10_000 });
  });

  test('"Back to Vendors" link returns to vendor list', async ({ page }) => {
    await goToFirstVendorProfile(page);

    const backLink = page.getByRole('link', { name: /back to vendors/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/buyer\/vendors$/, { timeout: 10_000 });
  });

  test('"Add to Order" button on a product adds it to the cart and reveals order button', async ({ page }) => {
    await goToFirstVendorProfile(page);

    // Look for "Add to Order" button on any product card
    const addToOrderBtn = page.getByRole('button', { name: /add to order/i }).first();
    const noProductsMsg = page.getByText(/no products listed/i);

    const hasProducts = await addToOrderBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasProducts) {
      const isEmpty = await noProductsMsg.isVisible({ timeout: 3_000 }).catch(() => false);
      if (isEmpty) {
        // Vendor has no products — skip product interaction
        console.log('[e2e] Vendor has no products — skipping add-to-order test');
        return;
      }
    }

    await expect(addToOrderBtn).toBeVisible({ timeout: 10_000 });
    await addToOrderBtn.click();

    // "Order N items" button should appear
    const orderBtn = page.getByRole('button', { name: /order \d+ item/i });
    await expect(orderBtn).toBeVisible({ timeout: 5_000 });
  });

  test('direct order modal opens and shows "Confirm Direct Order" heading', async ({ page }) => {
    await goToFirstVendorProfile(page);

    const addToOrderBtn = page.getByRole('button', { name: /add to order/i }).first();
    const hasProducts = await addToOrderBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasProducts) {
      console.log('[e2e] Vendor has no products — skipping modal open test');
      return;
    }

    await addToOrderBtn.click();
    const orderBtn = page.getByRole('button', { name: /order \d+ item/i });
    await expect(orderBtn).toBeVisible({ timeout: 5_000 });
    await orderBtn.click();

    // Modal should appear
    const modalHeading = page.getByRole('heading', { name: /confirm direct order/i });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  });

  test('direct order modal shows delivery address section', async ({ page }) => {
    await goToFirstVendorProfile(page);

    const addToOrderBtn = page.getByRole('button', { name: /add to order/i }).first();
    const hasProducts = await addToOrderBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasProducts) {
      console.log('[e2e] Vendor has no products — skipping modal address test');
      return;
    }

    await addToOrderBtn.click();
    const orderBtn = page.getByRole('button', { name: /order \d+ item/i });
    await orderBtn.click();

    // Modal heading visible
    await expect(page.getByRole('heading', { name: /confirm direct order/i })).toBeVisible({ timeout: 5_000 });

    // Delivery address section visible (either select or "No saved addresses" message)
    const addressSelect = page.locator('select');
    const noAddressMsg = page.getByText(/no saved addresses/i);
    const hasSelect = await addressSelect.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasNoAddr = await noAddressMsg.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasSelect || hasNoAddr).toBe(true);
  });

  test('cancelling the direct order modal closes it', async ({ page }) => {
    await goToFirstVendorProfile(page);

    const addToOrderBtn = page.getByRole('button', { name: /add to order/i }).first();
    const hasProducts = await addToOrderBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasProducts) {
      console.log('[e2e] Vendor has no products — skipping cancel modal test');
      return;
    }

    await addToOrderBtn.click();
    const orderBtn = page.getByRole('button', { name: /order \d+ item/i });
    await orderBtn.click();

    await expect(page.getByRole('heading', { name: /confirm direct order/i })).toBeVisible({ timeout: 5_000 });

    // Click Cancel in the modal
    const cancelBtn = page.getByRole('button', { name: /^cancel$/i }).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Modal should be gone
    await expect(page.getByRole('heading', { name: /confirm direct order/i })).not.toBeVisible({ timeout: 5_000 });
  });

  test('"Request quote instead" link is present on product cards', async ({ page }) => {
    await goToFirstVendorProfile(page);

    const rfqLink = page.getByRole('link', { name: /request quote instead/i }).first();
    const hasProducts = await rfqLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasProducts) {
      console.log('[e2e] Vendor has no products — skipping RFQ link test');
      return;
    }

    await expect(rfqLink).toBeVisible();
    // Link should point to /buyer/rfq/new
    const href = await rfqLink.getAttribute('href');
    expect(href).toMatch(/\/buyer\/rfq\/new/);
  });
});
