import { NextResponse, type NextRequest } from 'next/server';

type Role = 'PENDING' | 'BUYER' | 'VENDOR' | 'ADMIN';

// Order matters: more-specific prefixes must come before their parents.
const PROTECTED_ROUTES: Array<[string, Role[]]> = [
  ['/vendor/onboarding', ['PENDING', 'BUYER', 'VENDOR', 'ADMIN']], // PENDING/BUYER allowed to reach initial vendor onboarding
  ['/onboarding', ['PENDING', 'BUYER', 'VENDOR', 'ADMIN']],
  ['/buyer', ['BUYER', 'ADMIN']],
  ['/vendor', ['VENDOR', 'ADMIN']],
  ['/admin', ['ADMIN']],
];

function getAllowedRoles(pathname: string): Role[] | null {
  for (const [prefix, roles] of PROTECTED_ROUTES) {
    if (pathname.startsWith(prefix)) {
      return roles;
    }
  }

  return null;
}

function redirectToLogin(
  request: NextRequest,
  reason?: string,
): NextResponse {
  const url = new URL('/login', request.url);
  if (reason) {
    url.searchParams.set('reason', reason);
  }
  return NextResponse.redirect(url);
}

type MeResponsePayload = {
  role?: string;
};

function extractRole(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const direct = payload as MeResponsePayload;
  if (typeof direct.role === 'string') {
    return direct.role;
  }

  if ('data' in payload && payload.data && typeof payload.data === 'object') {
    const nested = payload.data as MeResponsePayload;
    if (typeof nested.role === 'string') {
      return nested.role;
    }
  }

  return null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const allowedRoles = getAllowedRoles(request.nextUrl.pathname);

  if (!allowedRoles) {
    return NextResponse.next();
  }

  const rawToken =
    request.cookies.get('access_token')?.value ??
    request.cookies.get('token')?.value;

  if (!rawToken) {
    return redirectToLogin(request);
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        // Backend currently validates the `access_token` cookie.
        cookie: `access_token=${encodeURIComponent(rawToken)}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return redirectToLogin(request);
    }

    const body = (await response.json()) as unknown;
    const role = extractRole(body);

    if (!role || !allowedRoles.includes(role as Role)) {
      return redirectToLogin(request);
    }

    return NextResponse.next();
  } catch (error: unknown) {
    if (
      error instanceof DOMException &&
      error.name === 'TimeoutError'
    ) {
      return redirectToLogin(request, 'timeout');
    }
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ['/buyer/:path*', '/vendor/:path*', '/admin/:path*', '/onboarding/:path*', '/onboarding'],
};
