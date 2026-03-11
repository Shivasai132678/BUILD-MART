import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetBuyerProfileDto } from './dto/set-buyer-profile.dto';

type OnboardingStatusResponse = {
  role: UserRole;
  name: string | null;
  displayName: string | null;
  hasVendorProfile: boolean;
  vendorApproved: boolean;
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOnboardingStatus(userId: string): Promise<OnboardingStatusResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        name: true,
        displayName: true,
        vendorProfile: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      role: user.role,
      name: user.name,
      displayName: user.displayName,
      hasVendorProfile: !!user.vendorProfile,
      vendorApproved: (user.vendorProfile?.status ?? '') === 'APPROVED',
    };
  }

  async setBuyerProfile(
    userId: string,
    dto: SetBuyerProfileDto,
  ): Promise<OnboardingStatusResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.BUYER && user.role !== UserRole.PENDING) {
      throw new BadRequestException(
        'Only buyers or new users can set buyer profile',
      );
    }

    const displayName = dto.companyName
      ? `${dto.name} (${dto.companyName})`
      : dto.name;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        displayName,
        role: UserRole.BUYER,
      },
    });

    this.logger.log(`Buyer profile set for userId=${userId}`);

    return this.getOnboardingStatus(userId);
  }
}
