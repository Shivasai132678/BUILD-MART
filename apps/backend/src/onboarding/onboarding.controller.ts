import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OnboardingService } from './onboarding.service';
import { SetBuyerProfileDto } from './dto/set-buyer-profile.dto';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

function getRequestUserId(request: AuthenticatedRequest): string {
  const userId = request.user?.sub;
  if (!userId) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }
  return userId;
}

@Controller({
  path: 'onboarding',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN, UserRole.PENDING)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  getOnboardingStatus(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.getOnboardingStatus(
      getRequestUserId(request),
    );
  }

  @Post('buyer-profile')
  @Roles(UserRole.BUYER, UserRole.PENDING)
  setBuyerProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetBuyerProfileDto,
  ) {
    return this.onboardingService.setBuyerProfile(
      getRequestUserId(request),
      dto,
    );
  }
}
