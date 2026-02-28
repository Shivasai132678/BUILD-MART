/**
 * E2E test: RFQ → Quote → Order flow
 *
 * Runs the full NestJS app against a real PostgreSQL test database.
 * Opt-in via TEST_DATABASE_URL or RUN_E2E_TESTS env vars.
 *
 * Prerequisites:
 *   1) Test database exists:
 *      psql -U buildmart -h localhost -p 5432 -c "CREATE DATABASE buildmart_test;"
 *   2) Run via: cd apps/backend && pnpm test:e2e
 */
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://buildmart:buildmart@localhost:5432/buildmart_test?connection_limit=5&pool_timeout=10';

const shouldRunE2E =
  !!process.env.TEST_DATABASE_URL || !!process.env.RUN_E2E_TESTS;

const describeIf = (condition: boolean) =>
  condition ? describe : describe.skip;

// Deterministic OTP for E2E auth flow
const KNOWN_OTP = '123456';
const KNOWN_OTP_HASH = createHash('sha256').update(KNOWN_OTP).digest('hex');

const BUYER_PHONE = '+919000100001';
const VENDOR_PHONE = '+919000100002';

describeIf(shouldRunE2E)('RFQ → Quote → Order (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Shared state across sequential happy-path tests
  let buyerCookie: string;
  let vendorCookie: string;
  let addressId: string;
  let productId: string;
  let rfqId: string;
  let quoteId: string;
  let orderId: string;
  let vendorProfileId: string;

  beforeAll(async () => {
    // Override env vars before module compilation
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.DIRECT_URL = TEST_DB_URL;
    process.env.JWT_SECRET = 'e2e-test-jwt-secret-key-0123456789';
    process.env.NODE_ENV = 'test';

    // Push schema to test DB
    const backendDir = path.resolve(__dirname, '..');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: backendDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
        DIRECT_URL: TEST_DB_URL,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts configuration
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Clean all tables for a fresh test run
    await cleanDatabase(prisma);

    // Seed: Category + Product
    const category = await prisma.category.create({
      data: {
        name: 'Cement',
        slug: 'cement',
        description: 'Cement products',
      },
    });

    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: 'OPC 53 Grade Cement',
        unit: 'bag',
        basePrice: 400,
      },
    });
    productId = product.id;
  }, 120_000);

  afterAll(async () => {
    if (prisma) await cleanDatabase(prisma);
    if (app) await app.close();
  });

  /**
   * Authenticate a user via the OTP flow:
   *   1. POST /auth/send-otp  → creates/upserts user + OTP record
   *   2. Inject a known OTP hash into DB (so verify-otp is deterministic)
   *   3. POST /auth/verify-otp → returns access_token cookie
   */
  async function authenticateUser(phone: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/send-otp')
      .send({ phone })
      .expect(200);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error(`User not found for phone ${phone}`);

    // Inject deterministic OTP (findFirst orders by createdAt desc, so latest wins)
    await prisma.oTPRecord.create({
      data: {
        userId: user.id,
        otpHash: KNOWN_OTP_HASH,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ phone, otp: KNOWN_OTP })
      .expect(200);

    const setCookie = res.headers['set-cookie'];
    const cookie: string = Array.isArray(setCookie) ? setCookie[0] : setCookie;

    expect(cookie).toContain('access_token');
    return cookie;
  }

  // ──────────────────────────────────────────────
  // Happy path (sequential — each step feeds next)
  // ──────────────────────────────────────────────

  describe('Happy path: RFQ → Quote → Order → Delivered', () => {
    it('Step 1-2: Buyer authenticates via OTP', async () => {
      buyerCookie = await authenticateUser(BUYER_PHONE);
    });

    it('Step 3: Buyer creates a delivery address', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/addresses')
        .set('Cookie', buyerCookie)
        .send({
          label: 'Site Office',
          line1: '123 Main Road',
          area: 'Gachibowli',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500032',
        })
        .expect(201);

      addressId = res.body.data.id;
      expect(addressId).toBeDefined();
    });

    it('Step 4: Buyer creates an RFQ', async () => {
      const validUntil = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/rfq')
        .set('Cookie', buyerCookie)
        .send({
          addressId,
          validUntil,
          items: [{ productId, quantity: 100, unit: 'bag' }],
        })
        .expect(201);

      rfqId = res.body.data.id;
      expect(rfqId).toBeDefined();
      expect(res.body.data.status).toBe('OPEN');
    });

    it('Step 5-6: Vendor authenticates via OTP', async () => {
      vendorCookie = await authenticateUser(VENDOR_PHONE);
    });

    it('Step 7: Vendor onboards (role upgrades BUYER → VENDOR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/vendors/onboard')
        .set('Cookie', vendorCookie)
        .send({
          businessName: 'Test Cement Supplier',
          gstNumber: '29ABCDE1234F1Z5',
          city: 'Hyderabad',
          serviceableAreas: ['Gachibowli', 'Madhapur'],
        })
        .expect(201);

      vendorProfileId = res.body.data.id;
      expect(vendorProfileId).toBeDefined();
    });

    it('Step 8: Vendor re-authenticates to get fresh VENDOR JWT', async () => {
      vendorCookie = await authenticateUser(VENDOR_PHONE);
    });

    it('Step 9: Seed vendor product + approve vendor (direct DB)', async () => {
      // Approve the vendor profile
      await prisma.vendorProfile.update({
        where: { id: vendorProfileId },
        data: { isApproved: true, approvedAt: new Date() },
      });

      // Map vendor to the seeded product
      await prisma.vendorProduct.create({
        data: { vendorId: vendorProfileId, productId },
      });

      const profile = await prisma.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { products: true },
      });
      expect(profile?.isApproved).toBe(true);
      expect(profile?.products).toHaveLength(1);
    });

    it('Step 10: Vendor sees available RFQs matching their products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/rfq/available')
        .set('Cookie', vendorCookie)
        .expect(200);

      const rfqs = res.body.data.items;
      expect(rfqs.length).toBeGreaterThanOrEqual(1);
      expect(rfqs.some((r: { id: string }) => r.id === rfqId)).toBe(true);
    });

    it('Step 11: Vendor submits a quote for the RFQ', async () => {
      const validUntil = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Cookie', vendorCookie)
        .send({
          rfqId,
          subtotal: '40000.00',
          taxAmount: '7200.00',
          deliveryFee: '500.00',
          totalAmount: '47700.00',
          validUntil,
          items: [
            {
              productName: 'OPC 53 Grade Cement',
              quantity: '100',
              unit: 'bag',
              unitPrice: '400.00',
              subtotal: '40000.00',
            },
          ],
        })
        .expect(201);

      quoteId = res.body.data.id;
      expect(quoteId).toBeDefined();
    });

    it('Step 12: Buyer views quotes for the RFQ', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quotes/rfq/${rfqId}`)
        .set('Cookie', buyerCookie)
        .expect(200);

      const quotes = res.body.data.data;
      expect(quotes.length).toBeGreaterThanOrEqual(1);
      expect(quotes.some((q: { id: string }) => q.id === quoteId)).toBe(true);
    });

    it('Step 13: Buyer accepts quote → creates order (CONFIRMED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Cookie', buyerCookie)
        .send({ quoteId })
        .expect(201);

      orderId = res.body.data.id;
      expect(orderId).toBeDefined();
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('Step 14: Vendor updates order → OUT_FOR_DELIVERY', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Cookie', vendorCookie)
        .send({ status: 'OUT_FOR_DELIVERY' })
        .expect(200);

      expect(res.body.data.status).toBe('OUT_FOR_DELIVERY');
    });

    it('Step 15: Vendor updates order → DELIVERED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Cookie', vendorCookie)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(res.body.data.status).toBe('DELIVERED');
    });

    it('Step 16: Verify RFQ status is CLOSED', async () => {
      const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId } });
      expect(rfq?.status).toBe('CLOSED');
    });
  });

  // ──────────────────────────────────────────
  // Error paths
  // ──────────────────────────────────────────

  describe('Error paths', () => {
    it('POST /api/v1/rfq without auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/rfq')
        .send({
          addressId: 'fake-id',
          validUntil: new Date().toISOString(),
          items: [{ productId: 'fake', quantity: 1, unit: 'bag' }],
        })
        .expect(401);
    });

    it('POST /api/v1/quotes as BUYER → 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Cookie', buyerCookie)
        .send({
          rfqId: 'fake-rfq-id',
          subtotal: '100.00',
          taxAmount: '18.00',
          deliveryFee: '10.00',
          totalAmount: '128.00',
          validUntil: new Date(Date.now() + 86_400_000).toISOString(),
          items: [
            {
              productName: 'Test',
              quantity: '1',
              unit: 'bag',
              unitPrice: '100.00',
              subtotal: '100.00',
            },
          ],
        })
        .expect(403);
    });

    it('POST /api/v1/orders with non-existent quoteId → 404', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Cookie', buyerCookie)
        .send({ quoteId: 'non-existent-quote-id' })
        .expect(404);
    });

    it('PATCH /api/v1/orders/:id/status with invalid transition → 400', async () => {
      // Order is already DELIVERED — cannot transition backwards
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Cookie', vendorCookie)
        .send({ status: 'OUT_FOR_DELIVERY' })
        .expect(400);
    });
  });
});

/**
 * Deletes all rows from every table, respecting FK constraint order.
 */
async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.review.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.rFQItem.deleteMany(),
    prisma.rFQ.deleteMany(),
    prisma.address.deleteMany(),
    prisma.vendorProduct.deleteMany(),
    prisma.vendorProfile.deleteMany(),
    prisma.oTPRecord.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
