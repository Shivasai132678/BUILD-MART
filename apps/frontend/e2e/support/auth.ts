/**
 * Shared constants and helpers for e2e specs.
 */
import path from 'node:path';

export const AUTH_DIR = path.resolve(__dirname, '../../.auth');

export const STORAGE = {
  admin:  path.join(AUTH_DIR, 'admin.json'),
  buyer:  path.join(AUTH_DIR, 'buyer.json'),
  vendor: path.join(AUTH_DIR, 'vendor.json'),
} as const;

export const PHONES = {
  admin:  '+919000000001',
  buyer:  '+919000000002',
  vendor: '+919000000004',
} as const;

export const E2E_OTP = process.env.E2E_TEST_OTP ?? '123456';
