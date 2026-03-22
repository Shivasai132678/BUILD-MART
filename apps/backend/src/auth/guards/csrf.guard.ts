import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set([
  '/api/v1/auth/send-otp',
  '/api/v1/auth/verify-otp',
]);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = (request.method ?? 'GET').toUpperCase();

    if (SAFE_METHODS.has(method)) {
      return true;
    }

    if (this.isCsrfExemptPath(request)) {
      this.ensureTrustedSourceForAuthBootstrap(request);
      return true;
    }

    const accessToken = this.readCookie(request, 'access_token');
    if (!accessToken) {
      return true;
    }

    const csrfCookie = this.readCookie(request, 'csrf_token');
    const csrfHeader = this.readCsrfHeader(request);

    if (
      csrfCookie &&
      csrfHeader &&
      this.constantTimeEquals(csrfCookie, csrfHeader)
    ) {
      return true;
    }

    throw new ForbiddenException('CSRF token missing or invalid');
  }

  private isCsrfExemptPath(request: Request): boolean {
    const requestPath =
      request.originalUrl ?? request.url ?? request.path ?? '';
    const normalizedPath = requestPath.split('?')[0];
    return CSRF_EXEMPT_PATHS.has(normalizedPath);
  }

  private ensureTrustedSourceForAuthBootstrap(request: Request): void {
    const originHeader = this.readOriginHeader(request);
    const refererHeader = this.readRefererHeader(request);
    const refererOrigin = this.readOriginFromReferer(refererHeader);

    if (!originHeader && !refererHeader) {
      // Allow non-browser contexts (CLI/e2e) that don't send origin metadata.
      return;
    }

    if (refererHeader && !refererOrigin) {
      throw new ForbiddenException('Untrusted origin');
    }

    const trustedOrigin = this.readTrustedFrontendOrigin();
    if (!trustedOrigin) {
      throw new ForbiddenException('Untrusted origin');
    }

    if (originHeader && originHeader !== trustedOrigin) {
      throw new ForbiddenException('Untrusted origin');
    }

    if (refererOrigin && refererOrigin !== trustedOrigin) {
      throw new ForbiddenException('Untrusted origin');
    }
  }

  private readOriginHeader(request: Request): string | null {
    const headerValue = request.headers.origin;
    return typeof headerValue === 'string' && headerValue.length > 0
      ? headerValue
      : null;
  }

  private readRefererHeader(request: Request): string | null {
    const headerValue = request.headers.referer;
    return typeof headerValue === 'string' && headerValue.length > 0
      ? headerValue
      : null;
  }

  private readOriginFromReferer(referer: string | null): string | null {
    if (!referer) {
      return null;
    }

    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  private readTrustedFrontendOrigin(): string | null {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      return null;
    }

    try {
      return new URL(frontendUrl).origin;
    } catch {
      return null;
    }
  }

  private readCsrfHeader(request: Request): string | null {
    const headerValue = request.headers['x-csrf-token'];

    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? null;
    }

    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    return null;
  }

  private readCookie(request: Request, cookieName: string): string | null {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const fromCookies = cookies?.[cookieName];
    if (typeof fromCookies === 'string' && fromCookies.length > 0) {
      return fromCookies;
    }

    const cookieHeader = request.headers?.cookie;
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
      return null;
    }

    for (const rawCookie of cookieHeader.split(';')) {
      const [rawKey, ...rawValueParts] = rawCookie.trim().split('=');
      if (rawKey === cookieName) {
        const value = rawValueParts.join('=').trim();
        if (value.length === 0) {
          return null;
        }

        return this.safeDecodeCookieValue(value);
      }
    }

    return null;
  }

  private safeDecodeCookieValue(value: string): string | null {
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
