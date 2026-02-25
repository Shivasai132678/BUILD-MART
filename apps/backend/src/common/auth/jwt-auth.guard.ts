import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    role?: string;
  };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}
