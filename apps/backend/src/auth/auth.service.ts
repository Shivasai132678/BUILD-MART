import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
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
  };
};

type LogoutResponse = {
  message: 'Logged out';
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly msg91Adapter: Msg91Adapter,
  ) { }

  async sendOtp({ phone }: SendOtpDto): Promise<SendOtpResponse> {
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        role: UserRole.BUYER,
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

    const e2eOtp = this.isE2ETestOtpEnabled() ? process.env.E2E_TEST_OTP : undefined;
    const otp = e2eOtp ?? randomInt(100_000, 1_000_000).toString();

    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(e2eOtp ? `[E2E] Fixed OTP for ${phone}: ${otp}` : `[DEV] OTP for ${phone}: ${otp}`);
    }

    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.oTPRecord.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
        isUsed: false,
      },
    });

    this.logger.debug(`OTP sent for phone ending: ${phone.slice(-4)}`);
    await this.msg91Adapter.sendOtp(phone, otp);

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
          },
        },
      },
    });

    if (!latestOtpRecord) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const incomingOtpHash = createHash('sha256').update(otp).digest('hex');
    if (incomingOtpHash !== latestOtpRecord.otpHash) {
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
    const payload: JwtTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'],
    });

    response.cookie('access_token', token, this.buildAccessTokenCookieOptions());

    return {
      message: 'Verified',
      user,
    };
  }

  logout(response: Response): LogoutResponse {
    response.clearCookie('access_token', this.buildBaseCookieOptions());
    return { message: 'Logged out' };
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private isE2ETestOtpEnabled(): boolean {
    return process.env.NODE_ENV !== 'production' && !!process.env.E2E_TEST_OTP;
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }

    return secret;
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

    const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());

    if (!match) {
      this.logger.warn(
        `Could not parse JWT_EXPIRES_IN="${value}", defaulting to 7d`,
      );
      return SEVEN_DAYS_MS;
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2] ?? 's';

    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1_000,
      m: 60 * 1_000,
      h: 60 * 60 * 1_000,
      d: 24 * 60 * 60 * 1_000,
    };

    return amount * multipliers[unit];
  }
}
