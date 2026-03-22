/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, VendorStatus } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { Msg91Adapter } from './providers/msg91.adapter';

describe('AuthService critical flows', () => {
  let service: AuthService;
  let originalNodeEnv: string | undefined;
  let originalJwtExpiresIn: string | undefined;
  let originalRunE2ETests: string | undefined;

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

  function buildResponse(): Response {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    originalJwtExpiresIn = process.env.JWT_EXPIRES_IN;
    originalRunE2ETests = process.env.RUN_E2E_TESTS;
    process.env.NODE_ENV = 'development';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.E2E_TEST_OTP = '123456';
    delete process.env.RUN_E2E_TESTS;

    service = new AuthService(prisma, jwtService, msg91Adapter);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalJwtExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalJwtExpiresIn;
    }

    if (originalRunE2ETests === undefined) {
      delete process.env.RUN_E2E_TESTS;
    } else {
      process.env.RUN_E2E_TESTS = originalRunE2ETests;
    }

    delete process.env.E2E_TEST_OTP;
  });

  it('refreshes token with vendor flags and sets secure cookie options', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u-1',
      phone: '+919000000001',
      role: UserRole.VENDOR,
      name: 'Vendor User',
      displayName: 'Vendor User',
      vendorProfile: { status: VendorStatus.APPROVED },
    });
    (jwtService.signAsync as jest.Mock).mockResolvedValue('token-refresh-1');

    const res = buildResponse();
    const out = await service.refreshToken('u-1', res);

    expect(out).toEqual({
      message: 'Refreshed',
      user: {
        id: 'u-1',
        phone: '+919000000001',
        role: UserRole.VENDOR,
        name: 'Vendor User',
        displayName: 'Vendor User',
        hasVendorProfile: true,
        vendorApproved: true,
      },
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u-1',
        role: UserRole.VENDOR,
        hasVendorProfile: true,
        vendorApproved: true,
      }),
    );
    expect((res.cookie as jest.Mock).mock.calls[0][0]).toBe('access_token');
    expect((res.cookie as jest.Mock).mock.calls[0][1]).toBe('token-refresh-1');
  });

  it('throws UnauthorizedException when refreshing non-existent user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.refreshToken('missing-user', buildResponse()),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logout clears access_token cookie with base options', () => {
    const res = buildResponse();
    const out = service.logout(res);

    expect(out).toEqual({ message: 'Logged out' });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'access_token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });

  it('sendOtp uses fixed E2E OTP and skips external provider call in test mode', async () => {
    process.env.NODE_ENV = 'test';

    (prisma.user.upsert as jest.Mock).mockResolvedValue({
      id: 'u-otp',
      phone: '+919000000077',
      role: UserRole.PENDING,
    });
    (prisma.oTPRecord.count as jest.Mock).mockResolvedValue(0);
    (prisma.oTPRecord.create as jest.Mock).mockResolvedValue({ id: 'otp-1' });
    (msg91Adapter.sendOtp as jest.Mock).mockResolvedValue(undefined);

    await service.sendOtp({ phone: '+919000000077' });

    expect(msg91Adapter.sendOtp).not.toHaveBeenCalled();
  });

  it('throws when JWT_EXPIRES_IN is invalid', async () => {
    process.env.JWT_EXPIRES_IN = 'not-a-duration';
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u-2',
      phone: '+919000000002',
      role: UserRole.BUYER,
      name: null,
      displayName: null,
      vendorProfile: null,
    });
    (jwtService.signAsync as jest.Mock).mockResolvedValue('token-refresh-2');

    await expect(service.refreshToken('u-2', buildResponse())).rejects.toThrow(
      'Invalid JWT_EXPIRES_IN value',
    );
  });
});
