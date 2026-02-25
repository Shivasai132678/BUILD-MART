Rule  1: Controllers contain zero business logic. Logic lives in services only.
Rule  2: Services never import other services directly — use NestJS DI only.
Rule  3: All money fields use Prisma Decimal(10,2). No exceptions.
Rule  4: Never use Float, Number, or JS number type for currency calculations.
Rule  5: Vendor-RFQ matching MUST use product-level query (see ARCHITECTURE.md).
         Category-level matching is explicitly forbidden.
Rule  6: OTP stored as SHA-256 hash in OTPRecord.otpHash. Never plaintext.
Rule  7: OTP record has expiresAt (5 min from creation) and isUsed boolean.
         Verify: check expiry → check isUsed=false → set isUsed=true (atomic).
Rule  8: JWT issued via HTTP-only cookie only. Never returned in response body.
Rule  9: No localStorage usage for authentication tokens. Ever.
Rule 10: CORS must whitelist only process.env.FRONTEND_URL. Never allow "*".
Rule 11: Every list/collection endpoint must support pagination (limit + offset).
Rule 12: @Throttle(5, 60) on POST /api/v1/auth/send-otp and /auth/verify-otp.
Rule 13: @Throttle(10, 60) on POST /api/v1/rfq.
Rule 14: Razorpay webhook handler checks if Payment.status is already SUCCESS.
         If already SUCCESS → return HTTP 200 immediately, no re-processing.
         Idempotency is mandatory.
Rule 15: All notifications routed through NotificationsService exclusively.
         No WhatsApp, SMS, or email calls in any other module.
Rule 16: DATABASE_URL must include ?connection_limit=5&pool_timeout=10
Rule 17: All DB timestamps stored in UTC. Backend never converts timezones.
Rule 18: Frontend date formatting exclusively via:
           apps/frontend/lib/utils/date.ts → formatIST(date: Date | string)
           Uses Intl.DateTimeFormat with timeZone: "Asia/Kolkata"
           No other date formatting permitted anywhere in the frontend.
Rule 19: Order status transitions enforced by state machine in OrderService.
         Validate against ARCHITECTURE.md transitions before every status update.
         Invalid transitions throw BadRequestException with descriptive message.
Rule 20: All backend routes prefixed with API version:
           app.setGlobalPrefix("api");
           app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
         All endpoints resolve as /api/v1/...
Rule 21: No schema modification after bootstrap without a named migration file.
         Dev command: cd apps/backend && npx prisma migrate dev --name <name>
         CI command:  cd apps/backend && npx prisma migrate deploy
         Never use prisma migrate dev in CI/CD pipelines. Use migrate deploy only.
         Prisma version is locked at ^6. Never upgrade to Prisma 7 without a
         dedicated migration task in PROJECT_TASKS.md and team approval.


Rule 22: Swagger must ONLY be enabled when NODE_ENV !== "production".
         Implementation in apps/backend/src/main.ts:
           if (process.env.NODE_ENV !== 'production') {
             const config = new DocumentBuilder()
               .setTitle('BuildMart API').setVersion('1.0').build();
             const document = SwaggerModule.createDocument(app, config);
             SwaggerModule.setup('api/docs', app, document);
           }
         Never expose /api/docs in production environment.

Violation of any rule requires IMMEDIATE correction before committing.
