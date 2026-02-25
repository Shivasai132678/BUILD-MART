import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaClient, UserRole } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
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
  private readonly prisma = new PrismaClient();

  constructor(private readonly jwtService: JwtService) {}

  async sendOtp({ phone }: SendOtpDto): Promise<SendOtpResponse> {
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        role: UserRole.BUYER,
      },
    });

    const otp = randomInt(100_000, 1_000_000).toString();
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

    this.logger.log(`OTP for ${phone}: ${otp}`);
    // TODO: integrate MSG91 — see ENV.md for credentials

    return { message: 'OTP sent' };
  }

  async verifyOtp(
    { phone, otp }: VerifyOtpDto,
    response: Response,
  ): Promise<VerifyOtpResponse> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const now = new Date();
    const latestOtpRecord = await this.prisma.oTPRecord.findFirst({
      where: {
        userId: user.id,
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestOtpRecord) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const incomingOtpHash = this.hashOtp(otp);
    if (!this.hashesMatch(latestOtpRecord.otpHash, incomingOtpHash)) {
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

  private hashesMatch(expectedHash: string, incomingHash: string): boolean {
    const expected = Buffer.from(expectedHash, 'utf8');
    const incoming = Buffer.from(incomingHash, 'utf8');

    if (expected.length !== incoming.length) {
      return false;
    }

    return timingSafeEqual(expected, incoming);
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }

    return secret;
  }

  private buildBaseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  private buildAccessTokenCookieOptions(): CookieOptions {
    const baseOptions = this.buildBaseCookieOptions();
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

    return {
      ...baseOptions,
      maxAge: maxAgeMs,
    };
  }
}
