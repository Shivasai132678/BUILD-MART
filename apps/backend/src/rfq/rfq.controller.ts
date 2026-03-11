import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RFQStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { RfqService } from './rfq.service';

const RFQ_CREATE_RATE_LIMIT = {
  default: {
    limit: 10,
    ttl: 60_000,
  },
} as const;

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

function getRequestUser(request: AuthenticatedRequest): {
  userId: string;
  role: UserRole;
} {
  const userId = request.user?.sub;
  const role = request.user?.role;

  if (!userId || !role) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return { userId, role };
}

@Controller({
  path: 'rfq',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Post()
  @Roles(UserRole.BUYER)
  @Throttle(RFQ_CREATE_RATE_LIMIT)
  createRFQ(@Req() request: AuthenticatedRequest, @Body() dto: CreateRfqDto) {
    const { userId } = getRequestUser(request);
    return this.rfqService.createRFQ(userId, dto);
  }

  @Get()
  @Roles(UserRole.BUYER)
  listRFQs(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: RFQStatus,
  ) {
    const { userId } = getRequestUser(request);
    return this.rfqService.listRFQs(userId, limit, offset, status);
  }

  @Get('available')
  @Roles(UserRole.VENDOR)
  getAvailableRFQs(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const { userId } = getRequestUser(request);
    return this.rfqService.getAvailableRFQs(userId, limit, offset);
  }

  @Get('browse')
  @Roles(UserRole.VENDOR)
  browseAllRFQs(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('categoryId') categoryId?: string,
  ) {
    getRequestUser(request); // validates auth
    return this.rfqService.browseAllRFQs(limit, offset, categoryId);
  }

  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  getRFQ(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const { userId, role } = getRequestUser(request);
    return this.rfqService.getRFQ(id, userId, role);
  }

  @Patch(':id/close')
  @Roles(UserRole.BUYER)
  closeRFQ(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const { userId } = getRequestUser(request);
    return this.rfqService.closeRFQ(id, userId);
  }
}
