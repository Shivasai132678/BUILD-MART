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

## Session End: 2026-02-25T18:33:45Z
- Completed: Vendor onboarding Task 1 DTOs (onboard/update) with Indian GST regex validation using class-validator @Matches
- Branch: feature/vendor
- Last commit: abcc51c feat(vendor): add onboarding DTOs with GST regex validation
- Next task: Vendor profile service + Cloudinary document upload adapter | Files: apps/backend/src/vendors/vendors.service.ts, apps/backend/src/files/cloudinary.adapter.ts, apps/backend/src/vendors/vendors.module.ts
- Known issues: Branch intentionally created from develop (not feature/auth), so auth-related dependencies and modules are not present here yet; task 18 tracker paths use `vendors/...` but DTOs were created under `src/vendor/dto/*` per explicit user instruction.
- Verify: review apps/backend/src/vendor/dto/onboard-vendor.dto.ts and apps/backend/src/vendor/dto/update-vendor.dto.ts for GST regex decorators
- Context: No schema changes and no new Prisma models. DTOs contain validation decorators only (no business logic).

## Session End: 2026-02-25T18:49:19Z
- Completed: Vendor onboarding Task 2 service/module — VendorService.onboard/getProfile/updateProfile with PrismaService DI, conflict/not-found guards, partial updates, and Nest Logger usage
- Branch: feature/vendor
- Last commit: 77c472b feat(vendor): add vendor service methods with Prisma DI
- Next task: Vendor profile endpoints (GET/PATCH) with ownership checks | Files: apps/backend/src/vendors/vendors.controller.ts, apps/backend/src/vendors/vendors.service.ts
- Known issues: Task 19 checkbox was marked complete per explicit instruction, but Cloudinary adapter is intentionally deferred in this branch/task; minimal PrismaService/PrismaModule support was added on feature/vendor because develop did not have Prisma DI infrastructure.
- Verify: cd apps/backend && pnpm build
- Context: No schema changes or migrations. VendorService returns plain Prisma VendorProfile objects and updates only fields present in UpdateVendorDto.

## Session End: 2026-02-25T19:00:38Z
- Completed: Vendor onboarding Task 3 controller — POST /vendors/onboard, GET /vendors/profile, PATCH /vendors/profile wired to VendorService with JwtAuthGuard + role metadata; VendorModule registered in AppModule
- Branch: feature/vendor
- Last commit: 9c15fee feat(vendor): add vendor onboarding and profile controller routes
- Next task: Admin vendor approval endpoint + audit log entry | Files: apps/backend/src/admin/admin-vendors.controller.ts, apps/backend/src/vendors/vendors.service.ts, apps/backend/src/audit/*
- Known issues: Branch is based on develop, so backend skeleton/auth module from other branches is not present; minimal local `JwtAuthGuard` + `RolesGuard` + `Roles` decorator scaffolding were added for controller protection/role checks. Route version metadata is set (`version: '1'`), but `/api/v1/...` runtime path also depends on global prefix/versioning bootstrap from the backend skeleton branch.
- Verify: cd apps/backend && pnpm build
- Context: Controller has zero business logic and uses `@Body()`/`@Req()` only. Admin approve route intentionally skipped per task scope.
