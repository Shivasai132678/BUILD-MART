import { BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHttpHost(url = '/api/v1/test', method = 'GET') {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();

  const response = {
    status,
    json,
  };

  const request = {
    url,
    method,
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as ArgumentsHost;

  return { host, response, request };
}

describe('GlobalExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    jest.restoreAllMocks();
  });

  it('formats HttpException string response', () => {
    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost('/api/v1/demo', 'POST');

    const warnSpy = jest
      .spyOn(filter['logger'], 'warn')
      .mockImplementation(() => undefined);

    filter.catch(new HttpException('Bad input', 400), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Bad input',
        path: '/api/v1/demo',
      }),
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it('formats HttpException object response with array message', () => {
    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost();

    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);

    const exception = new BadRequestException({
      message: ['field1 is required', 'field2 is invalid'],
      error: 'BadRequest',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'BadRequest',
        message: ['field1 is required', 'field2 is invalid'],
      }),
    );
  });

  it('hides unknown error messages in production', () => {
    process.env.NODE_ENV = 'production';

    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost('/api/v1/secure', 'PUT');

    const errorSpy = jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('db password leaked?'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'InternalServerError',
        message: 'Internal server error',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('shows InternalServerErrorException message in non-production', () => {
    process.env.NODE_ENV = 'test';

    const filter = new GlobalExceptionFilter();
    const { host, response } = createHttpHost();

    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(new InternalServerErrorException('debug message'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
        message: 'debug message',
      }),
    );
  });
});
