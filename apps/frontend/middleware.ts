import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = {
  '/buyer': ['BUYER', 'ADMIN'],
  '/vendor': ['VENDOR', 'ADMIN'],
  '/admin': ['ADMIN'],
} as const;

type Role = 'BUYER' | 'VENDOR' | 'ADMIN';

function getAllowedRoles(pathname: string): readonly Role[] | null {
  for (const [prefix, roles] of Object.entries(PROTECTED_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      return roles;
    }
  }

  return null;
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/login', request.url));
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
    request.cookies.get('token')?.value ??
    request.cookies.get('access_token')?.value;

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
  } catch {
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ['/buyer/:path*', '/vendor/:path*', '/admin/:path*'],
};
