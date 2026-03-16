import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CounterOfferQuoteDto } from './dto/counter-offer-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

// Allow 60 requests per minute for the polled quotes endpoint
const QUOTES_POLL_RATE_LIMIT = {
  default: {
    limit: 60,
    ttl: 60_000,
  },
} as const;

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
  @Throttle(QUOTES_POLL_RATE_LIMIT)
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

  @Get('my/:rfqId')
  @Roles(UserRole.VENDOR)
  getVendorQuoteForRfq(
    @Param('rfqId') rfqId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const { userId } = getRequestUser(request);
    return this.quotesService.getVendorQuoteForRfq(rfqId, userId);
  }

  @Post(':id/counter')
  @Roles(UserRole.BUYER)
  counterOfferQuote(
    @Param('id') quoteId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CounterOfferQuoteDto,
  ) {
    const { userId } = getRequestUser(request);
    return this.quotesService.counterOfferQuote(userId, quoteId, dto);
  }

  @Post(':id/counter/respond')
  @Roles(UserRole.VENDOR)
  respondToCounterOffer(
    @Param('id') quoteId: string,
    @Req() request: AuthenticatedRequest,
    @Query('accept', ParseBoolPipe) accept: boolean,
  ) {
    const { userId } = getRequestUser(request);
    return this.quotesService.respondToCounterOffer(userId, quoteId, accept);
  }
}
