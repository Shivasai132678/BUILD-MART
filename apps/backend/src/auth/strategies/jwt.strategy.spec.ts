import { UserRole } from '@prisma/client';

describe('JwtStrategy', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    jest.resetModules();
  });

  it('throws when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    expect(() => {
      const module = require('./jwt.strategy') as {
        JwtStrategy: new () => unknown;
      };
      new module.JwtStrategy();
    }).toThrow('JWT_SECRET is not configured');
  });

  it('constructs with cookie extractor and returns payload on validate', async () => {
    process.env.JWT_SECRET = 'test-secret';

    const module = require('./jwt.strategy') as {
      JwtStrategy: new () => { validate: (payload: unknown) => unknown };
    };
    const strategy = new module.JwtStrategy();

    const payload = {
      sub: 'user-1',
      phone: '+919999999999',
      role: UserRole.BUYER,
      hasVendorProfile: false,
      vendorApproved: false,
    };

    expect(strategy.validate(payload)).toEqual(payload);
  });
});
