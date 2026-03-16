import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtTokenPayload = {
  sub: string;
  phone: string;
  role: UserRole;
  hasVendorProfile?: boolean;
  vendorApproved?: boolean;
};

function extractAccessTokenFromCookie(request?: Request): string | null {
  const cookieHeader = request?.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  for (const rawCookie of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = rawCookie.trim().split('=');

    if (rawKey === 'access_token') {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtTokenPayload): JwtTokenPayload {
    return payload;
  }
}
