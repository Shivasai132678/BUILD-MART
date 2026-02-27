import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

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
  path: 'notifications',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.notificationsService.listNotifications(
      getRequestUserId(request),
      limit,
      offset,
    );
  }

  @Patch('read-all')
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(getRequestUserId(request));
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAsRead(id, getRequestUserId(request));
  }
}
