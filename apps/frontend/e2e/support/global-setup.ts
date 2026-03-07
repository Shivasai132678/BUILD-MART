/**
 * Playwright global setup — runs once before all test suites.
 * Logs in as each role via the backend REST API and saves cookies to
 * .auth/<role>.json so individual specs can reuse them as storageState.
 *
 * Requires:
 *   - Backend running on PLAYWRIGHT_API_URL (default http://localhost:3001)
 *   - E2E_TEST_OTP env var set on the backend so OTP is deterministic
 */

import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const E2E_OTP = process.env.E2E_TEST_OTP ?? '123456';
const AUTH_DIR = path.resolve(__dirname, '../../.auth');

const USERS = [
  { role: 'admin',  phone: '+919000000001' },
  { role: 'buyer',  phone: '+919000000002' },
  { role: 'vendor', phone: '+919000000004' },
] as const;

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const { role, phone } of USERS) {
    const ctx = await request.newContext({ baseURL: API_BASE });

    // 1. Trigger OTP — backend uses E2E_TEST_OTP when set
    const sendRes = await ctx.post('/api/v1/auth/send-otp', {
      data: { phone },
    });
    if (!sendRes.ok()) {
      throw new Error(
        `[global-setup] send-otp failed for ${role} (${phone}): ${sendRes.status()} ${await sendRes.text()}`,
      );
    }

    // 2. Verify OTP — backend sets access_token HTTP-only cookie
    const verifyRes = await ctx.post('/api/v1/auth/verify-otp', {
      data: { phone, otp: E2E_OTP },
    });
    if (!verifyRes.ok()) {
      throw new Error(
        `[global-setup] verify-otp failed for ${role} (${phone}): ${verifyRes.status()} ${await verifyRes.text()}`,
      );
    }

    // 3. Persist cookies (includes HTTP-only access_token)
    const statePath = path.join(AUTH_DIR, `${role}.json`);
    await ctx.storageState({ path: statePath });
    await ctx.dispose();

    console.log(`[global-setup] ✓ ${role} auth saved → ${statePath}`);
  }
}
