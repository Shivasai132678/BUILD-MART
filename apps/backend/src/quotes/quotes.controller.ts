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
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

function getRequestUser(request: AuthenticatedRequest): { userId: string; role: UserRole } {
  const userId = request.user?.sub;
  const role = request.user?.role;

  if (!userId || !role) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return { userId, role };
}

@Controller({
  path: 'quotes',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  createQuote(@Req() request: AuthenticatedRequest, @Body() dto: CreateQuoteDto) {
    const { userId } = getRequestUser(request);
    return this.quotesService.createQuote(userId, dto);
  }

  @Get('rfq/:rfqId')
  @Roles(UserRole.BUYER)
  getQuotesForRFQ(
    @Param('rfqId') rfqId: string,
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const { userId } = getRequestUser(request);
    return this.quotesService.getQuotesForRFQ(rfqId, userId, limit, offset);
  }

  @Patch(':id')
  @Roles(UserRole.VENDOR)
  updateQuote(
    @Param('id') quoteId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateQuoteDto,
  ) {
    const { userId } = getRequestUser(request);
    return this.quotesService.updateQuote(quoteId, userId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.VENDOR)
  deleteQuote(@Param('id') quoteId: string, @Req() request: AuthenticatedRequest) {
    const { userId } = getRequestUser(request);
    return this.quotesService.deleteQuote(quoteId, userId);
  }
}
