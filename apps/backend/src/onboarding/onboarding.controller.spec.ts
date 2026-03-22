import { UnauthorizedException } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import type { OnboardingService } from './onboarding.service';

describe('OnboardingController', () => {
  const onboardingService = {
    getOnboardingStatus: jest.fn(),
    setBuyerProfile: jest.fn(),
  } as unknown as jest.Mocked<OnboardingService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates status and buyer profile endpoints for authenticated user', async () => {
    const controller = new OnboardingController(onboardingService);
    const req = { user: { sub: 'buyer-1' } } as const;

    (onboardingService.getOnboardingStatus as jest.Mock).mockResolvedValue({ role: 'BUYER' });
    (onboardingService.setBuyerProfile as jest.Mock).mockResolvedValue({ success: true });

    await expect(controller.getOnboardingStatus(req)).resolves.toEqual({ role: 'BUYER' });
    await expect(
      controller.setBuyerProfile(req, {
        name: 'Buyer One',
        email: 'buyer@example.com',
      }),
    ).resolves.toEqual({ success: true });
  });

  it('throws UnauthorizedException when request user is missing', async () => {
    const controller = new OnboardingController(onboardingService);

    expect(() => controller.getOnboardingStatus({} as never)).toThrow(
      UnauthorizedException,
    );
  });
});
