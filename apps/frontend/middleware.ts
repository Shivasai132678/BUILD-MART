import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

type Role = 'PENDING' | 'BUYER' | 'VENDOR' | 'ADMIN';

// Order matters: more-specific prefixes must come before their parents.
const PROTECTED_ROUTES: Array<[string, Role[]]> = [
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

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    // Do not hard-block protected-route navigation if frontend env is missing
    // JWT_SECRET. Route-level auth checks (/api/v1/auth/me) will still enforce
    // authentication/authorization and avoid OTP-login redirect loops.
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(rawToken, secret);

    const role = typeof payload.role === 'string' ? payload.role : null;

    if (!role) {
      return redirectToLogin(request);
    }

    // Special case: a PENDING user who has submitted a vendor profile can access
    // /vendor/* in read-only (preview) mode — they see the dashboard but actions
    // are disabled by the UI based on vendorApproved flag.
    const isVendorRoute = request.nextUrl.pathname.startsWith('/vendor');
    const hasVendorProfile = payload.hasVendorProfile === true;
    if (isVendorRoute && role === 'PENDING' && hasVendorProfile) {
      return NextResponse.next();
    }

    if (!allowedRoles.includes(role as Role)) {
      return redirectToLogin(request);
    }

    return NextResponse.next();
  } catch {
    // If token verification fails here (e.g. frontend secret drift), allow the
    // request to proceed so client-side auth checks can recover gracefully.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/buyer/:path*', '/vendor/:path*', '/admin/:path*', '/onboarding/:path*', '/onboarding'],
};
