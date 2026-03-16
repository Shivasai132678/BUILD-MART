import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { Msg91Adapter } from './providers/msg91.adapter';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    oTPRecord: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const msg91Adapter = {
    sendOtp: jest.fn(),
  } as unknown as Msg91Adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '7d';

    service = new AuthService(prisma, jwtService, msg91Adapter);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sendOtp', () => {
    it('creates OTPRecord with hashed OTP', async () => {
      const now = new Date('2026-02-27T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-1',
        phone: '+919000000099',
        role: UserRole.PENDING,
      });
      (prisma.oTPRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.oTPRecord.create as jest.Mock).mockResolvedValue({ id: 'otp-1' });
      (msg91Adapter.sendOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.sendOtp({ phone: '+919000000099' });

      expect(result).toEqual({ message: 'OTP sent' });
      expect(prisma.oTPRecord.create).toHaveBeenCalledTimes(1);

      const createArg = (prisma.oTPRecord.create as jest.Mock).mock.calls[0][0] as {
        data: {
          userId: string;
          otpHash: string;
          expiresAt: Date;
          isUsed: boolean;
        };
      };

      expect(createArg.data.userId).toBe('user-1');
      expect(createArg.data.otpHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createArg.data.expiresAt.toISOString()).toBe(
        new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      );
      expect(createArg.data.isUsed).toBe(false);

      const sentOtp = (msg91Adapter.sendOtp as jest.Mock).mock.calls[0][1] as string;
      expect(sentOtp).toMatch(/^\d{6}$/);
      expect(createArg.data.otpHash).not.toBe(sentOtp);
    });

    it('sets expiry 5 minutes from now', async () => {
      const now = new Date('2026-02-27T11:15:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-2',
        phone: '+919000000098',
        role: UserRole.PENDING,
      });
      (prisma.oTPRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.oTPRecord.create as jest.Mock).mockResolvedValue({ id: 'otp-2' });
      (msg91Adapter.sendOtp as jest.Mock).mockResolvedValue(undefined);

      await service.sendOtp({ phone: '+919000000098' });

      const createArg = (prisma.oTPRecord.create as jest.Mock).mock.calls[0][0] as {
        data: {
          expiresAt: Date;
        };
      };

      expect(createArg.data.expiresAt.getTime() - now.getTime()).toBe(5 * 60 * 1000);
    });

    it('throws if phone has more than 5 attempts in 60s (throttle)', async () => {
      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-3',
        phone: '+919000000097',
        role: UserRole.PENDING,
      });
      (prisma.oTPRecord.count as jest.Mock).mockResolvedValue(5);

      await expect(service.sendOtp({ phone: '+919000000097' })).rejects.toThrow(
        'Too many OTP attempts',
      );

      expect(prisma.oTPRecord.create).not.toHaveBeenCalled();
      expect(msg91Adapter.sendOtp).not.toHaveBeenCalled();
    });

    it('creates user as PENDING for first login phone number', async () => {
      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-4',
        phone: '+919000000096',
        role: UserRole.PENDING,
      });
      (prisma.oTPRecord.count as jest.Mock).mockResolvedValue(0);
      (prisma.oTPRecord.create as jest.Mock).mockResolvedValue({ id: 'otp-4' });
      (msg91Adapter.sendOtp as jest.Mock).mockResolvedValue(undefined);

      await service.sendOtp({ phone: '+919000000096' });

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { phone: '+919000000096' },
        update: {},
        create: {
          phone: '+919000000096',
          role: UserRole.PENDING,
        },
      });
    });
  });

  describe('verifyOtp', () => {
    const buildResponse = (): Response =>
      ({
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      }) as unknown as Response;

    it('returns user and sets isUsed=true on valid OTP', async () => {
      const otp = '123456';
      const otpHash = createHash('sha256').update(otp).digest('hex');

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-10',
        phone: '+919000000090',
        role: UserRole.BUYER,
      });
      (prisma.oTPRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'otp-record-10',
        userId: 'user-10',
        otpHash,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-10',
          phone: '+919000000090',
          role: UserRole.BUYER,
          name: null,
          displayName: null,
          vendorProfile: null,
        },
      });
      (prisma.oTPRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token-value');

      const response = buildResponse();

      const result = await service.verifyOtp(
        { phone: '+919000000090', otp },
        response,
      );

      expect(result).toEqual({
        message: 'Verified',
        user: {
          id: 'user-10',
          phone: '+919000000090',
          role: UserRole.BUYER,
          name: null,
          displayName: null,
          hasVendorProfile: false,
          vendorApproved: false,
        },
      });

      expect(prisma.oTPRecord.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'otp-record-10',
          isUsed: false,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        data: {
          isUsed: true,
        },
      });

      expect((response.cookie as jest.Mock).mock.calls[0][0]).toBe('access_token');
      expect((response.cookie as jest.Mock).mock.calls[0][1]).toBe('jwt-token-value');
    });

    it('throws UnauthorizedException on wrong hash', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-11',
        phone: '+919000000091',
        role: UserRole.BUYER,
      });
      (prisma.oTPRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'otp-record-11',
        userId: 'user-11',
        otpHash: createHash('sha256').update('000000').digest('hex'),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-11',
          phone: '+919000000091',
          role: UserRole.BUYER,
        },
      });

      const response = buildResponse();

      await expect(
        service.verifyOtp({ phone: '+919000000091', otp: '123456' }, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on expired OTP', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-12',
        phone: '+919000000092',
        role: UserRole.BUYER,
      });
      (prisma.oTPRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const response = buildResponse();

      await expect(
        service.verifyOtp({ phone: '+919000000092', otp: '123456' }, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on already-used OTP', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-13',
        phone: '+919000000093',
        role: UserRole.BUYER,
      });
      (prisma.oTPRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'otp-record-13',
        userId: 'user-13',
        otpHash: createHash('sha256').update('123456').digest('hex'),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-13',
          phone: '+919000000093',
          role: UserRole.BUYER,
        },
      });
      (prisma.oTPRecord.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const response = buildResponse();

      await expect(
        service.verifyOtp({ phone: '+919000000093', otp: '123456' }, response),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
