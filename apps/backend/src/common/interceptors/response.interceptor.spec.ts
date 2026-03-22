import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';

function makeExecutionContext(url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url }),
    }),
  } as ExecutionContext;
}

describe('ResponseInterceptor', () => {
  it('passes health endpoint response as-is', (done) => {
    const interceptor = new ResponseInterceptor<{ status: string }>();
    const context = makeExecutionContext('/api/health');
    const next = {
      handle: () => of({ status: 'ok' }),
    } as CallHandler<{ status: string }>;

    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual({ status: 'ok' });
      done();
    });
  });

  it('does not wrap already wrapped response', (done) => {
    const interceptor = new ResponseInterceptor<Record<string, unknown>>();
    const context = makeExecutionContext('/api/v1/orders');
    const payload = { success: true, data: { id: 'o-1' } };

    const next = {
      handle: () => of(payload),
    } as CallHandler<Record<string, unknown>>;

    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual(payload);
      done();
    });
  });

  it('wraps normal response with success envelope and path', (done) => {
    const interceptor = new ResponseInterceptor<{ id: string }>();
    const context = makeExecutionContext('/api/v1/products');
    const next = {
      handle: () => of({ id: 'prod-1' }),
    } as CallHandler<{ id: string }>;

    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual(
        expect.objectContaining({
          success: true,
          data: { id: 'prod-1' },
          path: '/api/v1/products',
          timestamp: expect.any(String),
        }),
      );
      done();
    });
  });
});
