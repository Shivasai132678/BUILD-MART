## Session: Bootstrap | Status: BLOCKED
- Step: Phase 0.4 — Prisma validate
- Error: Prisma schema validation - (validate wasm)
- Error code: P1012
- Exact message: The datasource property `url` is no longer supported in schema files. Move connection URLs for Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection or `accelerateUrl` for Accelerate to the `PrismaClient` constructor.
- Context: `npx prisma validate` installed Prisma CLI v7.4.1 via npx and rejected the locked schema format.
- Action: Stopped per prompt. Did not modify schema.
## Session: Bootstrap Recovery | Status: RESUMED
- Phase 0.4 UNBLOCKED — Prisma pinned to v6
# BuildMart — Agent Handoff Log
# One block appended per session. Never delete previous blocks.

## Session: Bootstrap | Status: PENDING
- Next task: Phase 1 — create all rule files

## Session End: 2026-02-25T15:23:12Z
- Completed: Phase 7 — Step 1 (shared constants, global exception filter, response interceptor, frontend formatIST utility); PROJECT_TASKS: Shared status constants and frontend IST date utility
- Branch: N/A (git not initialized yet; Phase 2 pending)
- Last commit: N/A (git repository not initialized)
- Next task: Backend runtime bootstrap hardening | Files: apps/backend/src/main.ts, apps/backend/src/app.module.ts, apps/backend/src/common/filters/global-exception.filter.ts, apps/backend/src/common/interceptors/response.interceptor.ts
- Known issues: AGENT_HANDOFF contains stale bootstrap "Next task: Phase 1" entry; root git repository not initialized yet (Phase 2 not executed)
- Verify: cd apps/backend && pnpm build && cd ../frontend && pnpm exec tsc --noEmit
- Context: Phase 7 Step 1 files are created and compile/type-check clean. Step 2 should wire API prefix/versioning, CORS whitelist, Helmet, and global filter/interceptor without changing schema.

## Session End: 2026-02-25T20:05:00Z
- Completed: Products & Categories Task 1 — category/product CRUD service + controllers + DTO validation (including Decimal-safe `basePrice` string DTO), pagination, Prisma DI, and ProductsModule wiring into AppModule
- Branch: feature/products
- Last commit: e0d3f5b feat(products): add products and categories CRUD module
- Next task: Products & Categories Task 3 — read-only product/category browsing for BUYER/VENDOR (or merge/align with auth/bootstrap work on develop before runtime testing)
- Known issues: `develop` branch lacked auth and Prisma DI scaffolding, so this session added minimal `src/common/auth/*` guards/decorator and `src/prisma/*`; routes use versioned controllers (`version: '1'`) but `/api/v1/...` runtime paths still depend on global prefix/versioning setup (Setup task remains unchecked on this branch); `JwtAuthGuard` is a placeholder request-user guard and requires upstream auth middleware/strategy to populate `req.user` for runtime access.
- Verify: cd apps/backend && pnpm build
- Context: Category CRUD and Product CRUD are implemented in a single `products` module/file set (`apps/backend/src/products/*`) rather than separate `categories/*` and `products/*` modules; no schema changes or migrations were made.
