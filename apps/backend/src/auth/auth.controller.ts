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
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_RATE_LIMIT)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(OTP_RATE_LIMIT)
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.verifyOtp(dto, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user: JwtTokenPayload }): JwtTokenPayload {
    return request.user;
  }
}
