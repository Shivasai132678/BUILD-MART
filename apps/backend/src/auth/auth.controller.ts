import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtTokenPayload } from './strategies/jwt.strategy';

const OTP_RATE_LIMIT = {
  default: {
    limit: 5,
    ttl: 60_000,
  },
} as const;

@Controller({
  path: 'auth',
  version: '1',
})
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_RATE_LIMIT)
  @ApiOperation({ summary: 'Send OTP to user phone' })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({
    description: 'OTP accepted for delivery',
    schema: {
      example: {
        success: true,
        data: { message: 'OTP sent successfully' },
        timestamp: '2026-03-21T00:00:00.000Z',
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'OTP rate limit exceeded' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_RATE_LIMIT)
  @ApiOperation({ summary: 'Verify OTP and establish session cookie' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'OTP verified and access_token cookie issued',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'user_123',
            phone: '+919876543210',
            role: 'BUYER',
            fullName: 'Buyer User',
          },
          onboarding: { completed: true, nextStep: null },
        },
        timestamp: '2026-03-21T00:00:00.000Z',
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'OTP verification rate limit exceeded' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.verifyOtp(dto, response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Refresh access token cookie using authenticated session' })
  @ApiOkResponse({
    description: 'Session refreshed',
    schema: {
      example: {
        success: true,
        data: { message: 'Session refreshed' },
        timestamp: '2026-03-21T00:00:00.000Z',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access_token cookie' })
  refresh(
    @Req() request: Request & { user: JwtTokenPayload },
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refreshToken(request.user.sub, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear access token cookie and logout user' })
  @ApiOkResponse({
    description: 'Logout completed',
    schema: {
      example: {
        success: true,
        data: { message: 'Logged out successfully' },
        timestamp: '2026-03-21T00:00:00.000Z',
      },
    },
  })
  logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get authenticated user payload from JWT' })
  @ApiOkResponse({
    description: 'Authenticated user context',
    schema: {
      example: {
        sub: 'user_123',
        phone: '+919876543210',
        role: 'VENDOR',
        hasVendorProfile: true,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access_token cookie' })
  me(
    @Req() request: Request & { user: JwtTokenPayload },
    @Res({ passthrough: true }) response: Response,
  ): JwtTokenPayload {
    this.authService.ensureCsrfCookie(request, response);
    return request.user;
  }
}
