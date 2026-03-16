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
import { DisputeStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; role?: UserRole };
};

@Controller({ path: 'disputes', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  // ─── Buyer endpoints ──────────────────────────────────────

  @Post()
  @Roles(UserRole.BUYER)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDisputeDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.disputesService.createDispute(userId, dto);
  }

  @Get('my')
  @Roles(UserRole.BUYER)
  async listMine(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: DisputeStatus,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.disputesService.listBuyerDisputes(userId, limit, offset, status);
  }

  // ─── Vendor endpoints ─────────────────────────────────────

  @Get('vendor')
  @Roles(UserRole.VENDOR)
  async listVendor(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: DisputeStatus,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.disputesService.listVendorDisputes(userId, limit, offset, status);
  }

  // ─── Shared buyer/vendor detail ───────────────────────────

  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  async getOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.disputesService.getDispute(id, userId);
  }

  // ─── Admin endpoints ──────────────────────────────────────

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  async listAll(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: DisputeStatus,
  ) {
    return this.disputesService.listAllDisputes(limit, offset, status);
  }

  @Patch('admin/:id/resolve')
  @Roles(UserRole.ADMIN)
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return this.disputesService.resolveDispute(id, userId, dto);
  }
}
