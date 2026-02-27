import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    sub?: string;
  };
};

function getAuthenticatedUserId(request: AuthenticatedRequest): string {
  const userId = request.user?.id ?? request.user?.sub;

  if (!userId) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return userId;
}

@Controller({
  path: 'addresses',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  createAddress(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.createAddress(getAuthenticatedUserId(request), dto);
  }

  @Get()
  listAddresses(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.addressesService.listAddresses(
      getAuthenticatedUserId(request),
      limit,
      offset,
    );
  }

  @Get(':id')
  getAddress(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.addressesService.getAddress(getAuthenticatedUserId(request), id);
  }

  @Patch(':id')
  updateAddress(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(getAuthenticatedUserId(request), id, dto);
  }

  @Delete(':id')
  softDeleteAddress(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.addressesService.softDeleteAddress(getAuthenticatedUserId(request), id);
  }
}
