import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;

  const makeContext = (role?: UserRole) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : {} }),
      }),
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no roles metadata is set', () => {
    const guard = new RolesGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(makeContext(UserRole.BUYER))).toBe(true);
  });

  it('throws when user role is missing', () => {
    const guard = new RolesGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('throws when user role is not in required roles', () => {
    const guard = new RolesGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(makeContext(UserRole.BUYER))).toThrow(ForbiddenException);
  });

  it('allows when user role is in required roles', () => {
    const guard = new RolesGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.BUYER, UserRole.ADMIN]);

    expect(guard.canActivate(makeContext(UserRole.BUYER))).toBe(true);
  });
});
