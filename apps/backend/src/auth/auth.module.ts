import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { Msg91Adapter } from './providers/msg91.adapter';
import { JwtStrategy } from './strategies/jwt.strategy';

function parseExpiresInToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(value.trim());

  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN value "${value}". Use formats like 900s, 15m, 24h, or 7d (milliseconds are not supported).`,
    );
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] ?? 's';

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return Math.max(1, Math.floor(amount * multipliers[unit]));
}

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseExpiresInToSeconds(
            cfg.getOrThrow<string>('JWT_EXPIRES_IN'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, Msg91Adapter],
  exports: [AuthService, PassportModule, JwtModule, RolesGuard],
})
export class AuthModule {}
