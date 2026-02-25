import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  timestamp: string;
  path?: string;
};

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, T | SuccessEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | SuccessEnvelope<T>> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const path = request?.url;

    return next.handle().pipe(
      map((data) => {
        // Keep the health endpoint payload minimal for uptime probes.
        if (path === '/api/health') {
          return data;
        }

        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }

  private isAlreadyWrapped(value: unknown): value is T {
    return this.isRecord(value) && typeof value.success === 'boolean';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
