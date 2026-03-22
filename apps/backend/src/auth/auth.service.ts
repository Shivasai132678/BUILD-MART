import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, VendorStatus } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Msg91Adapter } from './providers/msg91.adapter';
import type { JwtTokenPayload } from './strategies/jwt.strategy';

type SendOtpResponse = {
  message: 'OTP sent';
};

type VerifyOtpResponse = {
  message: 'Verified';
  user: {
    id: string;
    phone: string;
    role: UserRole;
    name: string | null;
    displayName: string | null;
    hasVendorProfile: boolean;
    vendorApproved: boolean;
  };
};

type LogoutResponse = {
  message: 'Logged out';
};

const CSRF_COOKIE_NAME = 'csrf_token';

type RefreshTokenResponse = {
  message: 'Refreshed';
  user: {
    id: string;
    phone: string;
    role: UserRole;
    name: string | null;
    displayName: string | null;
    hasVendorProfile: boolean;
    vendorApproved: boolean;
  };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly msg91Adapter: Msg91Adapter,
  ) {}

  private createCsrfToken(): string {
    return randomBytes(32).toString('hex');
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

    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
      const [rawKey, ...rawValueParts] = pair.trim().split('=');
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

  private buildCsrfCookieOptions(): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    const maxAgeMs = this.parseExpiresInToMs(process.env.JWT_EXPIRES_IN);
    return {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private setCsrfCookie(response: Response): void {
    response.cookie(
      CSRF_COOKIE_NAME,
      this.createCsrfToken(),
      this.buildCsrfCookieOptions(),
    );
  }

  async sendOtp({ phone }: SendOtpDto): Promise<SendOtpResponse> {
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        role: UserRole.PENDING,
      },
    });

    const recentAttemptCount = await this.prisma.oTPRecord.count({
      where: {
        userId: user.id,
        createdAt: {
          gt: new Date(Date.now() - 60_000),
        },
      },
    });

    if (recentAttemptCount >= 5) {
      throw new HttpException(
        'Too many OTP attempts. Please try again after 60 seconds',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const e2eOtp = this.isE2ETestOtpEnabled()
      ? process.env.E2E_TEST_OTP
      : undefined;
    const otp = e2eOtp ?? randomInt(100_000, 1_000_000).toString();

    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        e2eOtp ? '[E2E] Fixed OTP mode enabled' : '[DEV] OTP generated',
      );
    }

    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const createdOtp = await this.prisma.oTPRecord.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
        isUsed: false,
      },
    });

    if (e2eOtp) {
      return { message: 'OTP sent' };
    }

    try {
      await this.msg91Adapter.sendOtp(phone, otp);
    } catch {
      await this.prisma.oTPRecord.deleteMany({
        where: {
          id: createdOtp.id,
          isUsed: false,
        },
      });
      throw new ServiceUnavailableException(
        'OTP delivery failed. Please try again.',
      );
    }

    return { message: 'OTP sent' };
  }

  async verifyOtp(
    { phone, otp }: VerifyOtpDto,
    response: Response,
  ): Promise<VerifyOtpResponse> {
    const latestOtpRecord = await this.prisma.oTPRecord.findFirst({
      where: {
        user: {
          phone,
        },
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            role: true,
            name: true,
            displayName: true,
            vendorProfile: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!latestOtpRecord) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const incomingOtpHash = createHash('sha256').update(otp).digest('hex');
    if (
      !timingSafeEqual(
        Buffer.from(incomingOtpHash, 'hex'),
        Buffer.from(latestOtpRecord.otpHash, 'hex'),
      )
    ) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const updateResult = await this.prisma.oTPRecord.updateMany({
      where: {
        id: latestOtpRecord.id,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        isUsed: true,
      },
    });

    if (updateResult.count !== 1) {
      throw new UnauthorizedException('OTP expired or already used');
    }

    const user = latestOtpRecord.user;
    const hasVendorProfile = !!user.vendorProfile;
    const vendorApproved = user.vendorProfile?.status === VendorStatus.APPROVED;
    const payload: JwtTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      hasVendorProfile,
      vendorApproved,
    };

    // Use module-level JWT config (secret + expiresIn set in JwtModule.registerAsync)
    const token = await this.jwtService.signAsync(payload);

    response.cookie(
      'access_token',
      token,
      this.buildAccessTokenCookieOptions(),
    );
    this.setCsrfCookie(response);

    return {
      message: 'Verified',
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        displayName: user.displayName,
        hasVendorProfile,
        vendorApproved,
      },
    };
  }

  async refreshToken(
    userId: string,
    response: Response,
  ): Promise<RefreshTokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        role: true,
        name: true,
        displayName: true,
        vendorProfile: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hasVendorProfile = !!user.vendorProfile;
    const vendorApproved = user.vendorProfile?.status === VendorStatus.APPROVED;
    const payload: JwtTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      hasVendorProfile,
      vendorApproved,
    };

    // Use module-level JWT config (secret + expiresIn set in JwtModule.registerAsync)
    const token = await this.jwtService.signAsync(payload);

    response.cookie(
      'access_token',
      token,
      this.buildAccessTokenCookieOptions(),
    );
    this.setCsrfCookie(response);

    return {
      message: 'Refreshed',
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        displayName: user.displayName,
        hasVendorProfile,
        vendorApproved,
      },
    };
  }

  logout(response: Response): LogoutResponse {
    response.clearCookie('access_token', this.buildBaseCookieOptions());
    response.clearCookie(CSRF_COOKIE_NAME, this.buildCsrfCookieOptions());
    return { message: 'Logged out' };
  }

  ensureCsrfCookie(request: Request, response: Response): void {
    const hasAccessToken = this.readCookie(request, 'access_token') !== null;
    const hasCsrfCookie = this.readCookie(request, CSRF_COOKIE_NAME) !== null;

    if (hasAccessToken && !hasCsrfCookie) {
      this.setCsrfCookie(response);
    }
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private isE2ETestOtpEnabled(): boolean {
    const isTestRuntime =
      process.env.NODE_ENV === 'test' || process.env.RUN_E2E_TESTS === 'true';
    return isTestRuntime && !!process.env.E2E_TEST_OTP;
  }

  private buildBaseCookieOptions(): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      // cross-origin (Vercel → Render) requires sameSite: 'none' + secure: true
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
  }

  private buildAccessTokenCookieOptions(): CookieOptions {
    const baseOptions = this.buildBaseCookieOptions();
    const maxAgeMs = this.parseExpiresInToMs(process.env.JWT_EXPIRES_IN);

    return {
      ...baseOptions,
      maxAge: maxAgeMs,
    };
  }

  private parseExpiresInToMs(value: string | undefined): number {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    if (!value) {
      return SEVEN_DAYS_MS;
    }

    const match = /^(\d+)(s|m|h|d)?$/.exec(value.trim());

    if (!match) {
      throw new Error(
        `Invalid JWT_EXPIRES_IN value "${value}". Use formats like 900s, 15m, 24h, or 7d (milliseconds are not supported).`,
      );
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2] ?? 's';

    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60 * 1_000,
      h: 60 * 60 * 1_000,
      d: 24 * 60 * 60 * 1_000,
    };

    return amount * multipliers[unit];
  }
}
