import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

type HttpRequestLike = {
  method?: string;
  headers?: Record<string, unknown>;
  cookies?: Record<string, string | undefined>;
  originalUrl?: string;
  url?: string;
  path?: string;
};

function createContext(request: HttpRequestLike): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FRONTEND_URL = 'http://localhost:3000';
    guard = new CsrfGuard();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows safe methods without csrf token', () => {
    const request: HttpRequestLike = {
      method: 'GET',
      headers: {},
      cookies: {
        access_token: 'jwt',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('allows mutating requests with no access_token cookie', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      headers: {},
      cookies: {},
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('blocks mutating requests with access_token and missing x-csrf-token', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/orders',
      headers: {},
      cookies: {
        access_token: 'jwt',
        csrf_token: 'csrf-123',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('blocks mutating requests when x-csrf-token does not match csrf cookie', () => {
    const request: HttpRequestLike = {
      method: 'PATCH',
      originalUrl: '/api/v1/orders/order-1/status',
      headers: {
        'x-csrf-token': 'csrf-abc',
      },
      cookies: {
        access_token: 'jwt',
        csrf_token: 'csrf-def',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('allows mutating requests when x-csrf-token matches csrf cookie', () => {
    const request: HttpRequestLike = {
      method: 'DELETE',
      originalUrl: '/api/v1/orders/order-1',
      headers: {
        'x-csrf-token': 'csrf-match',
      },
      cookies: {
        access_token: 'jwt',
        csrf_token: 'csrf-match',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('blocks mutating requests without csrf tokens even when origin is trusted', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/orders',
      headers: {
        origin: 'http://localhost:3000',
      },
      cookies: {
        access_token: 'jwt',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('blocks mutating requests without csrf tokens even when referer origin is trusted', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/orders',
      headers: {
        referer: 'http://localhost:3000/buyer/rfq',
      },
      cookies: {
        access_token: 'jwt',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('blocks mutating requests even with trusted origin when csrf token mismatches', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/orders',
      headers: {
        origin: 'http://localhost:3000',
        'x-csrf-token': 'csrf-abc',
      },
      cookies: {
        access_token: 'jwt',
        csrf_token: 'csrf-def',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('blocks malformed csrf cookie values without throwing 500', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/orders',
      headers: {
        cookie: 'access_token=jwt; csrf_token=%E0%A4%A',
        'x-csrf-token': 'anything',
      },
      cookies: {},
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('allows csrf-exempt auth bootstrap routes without csrf headers', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/send-otp',
      headers: {
        origin: 'http://localhost:3000',
      },
      cookies: {
        access_token: 'stale-token',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('allows csrf-exempt auth verify route without csrf headers', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/verify-otp',
      headers: {
        referer: 'http://localhost:3000/login',
      },
      cookies: {
        access_token: 'stale-token',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('blocks auth logout route without csrf headers when access_token exists', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/logout',
      headers: {},
      cookies: {
        access_token: 'stale-token',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('CSRF token missing or invalid'),
    );
  });

  it('blocks csrf-exempt auth bootstrap route with untrusted origin', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/send-otp',
      headers: {
        origin: 'https://evil.example',
      },
      cookies: {},
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('Untrusted origin'),
    );
  });

  it('allows csrf-exempt auth bootstrap route when origin metadata missing', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/send-otp',
      headers: {},
      cookies: {},
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('blocks csrf-exempt auth bootstrap route with malformed referer', () => {
    const request: HttpRequestLike = {
      method: 'POST',
      originalUrl: '/api/v1/auth/verify-otp',
      headers: {
        referer: 'not-a-valid-url',
      },
      cookies: {},
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      new ForbiddenException('Untrusted origin'),
    );
  });
});
