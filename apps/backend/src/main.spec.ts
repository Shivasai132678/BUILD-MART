/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/unbound-method */
import { VersioningType } from '@nestjs/common';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('express', () => ({
  __esModule: true,
  default: {
    raw: jest.fn(() => 'raw-webhook-middleware'),
  },
}));

jest.mock('cookie-parser', () => ({
  __esModule: true,
  default: jest.fn(() => 'cookie-parser-middleware'),
}));

jest.mock('helmet', () => ({
  __esModule: true,
  default: jest.fn(() => 'helmet-middleware'),
}));

const swaggerCreateDocument = jest.fn(() => ({ openapi: '3.0.0' }));
const swaggerSetup = jest.fn();

class MockDocumentBuilder {
  setTitle(): this {
    return this;
  }

  setDescription(): this {
    return this;
  }

  setVersion(): this {
    return this;
  }

  addCookieAuth(): this {
    return this;
  }

  build(): Record<string, string> {
    return { mock: 'swagger-config' };
  }
}

jest.mock('@nestjs/swagger', () => {
  const actualSwagger =
    jest.requireActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');

  return {
    ...actualSwagger,
    SwaggerModule: {
      createDocument: swaggerCreateDocument,
      setup: swaggerSetup,
    },
    DocumentBuilder: MockDocumentBuilder,
  };
});

type AppMock = {
  setGlobalPrefix: jest.Mock;
  enableVersioning: jest.Mock;
  use: jest.Mock;
  enableCors: jest.Mock;
  useGlobalFilters: jest.Mock;
  useGlobalInterceptors: jest.Mock;
  useGlobalPipes: jest.Mock;
  listen: jest.Mock;
};

function createAppMock(): AppMock {
  return {
    setGlobalPrefix: jest.fn(),
    enableVersioning: jest.fn(),
    use: jest.fn(),
    enableCors: jest.fn(),
    useGlobalFilters: jest.fn(),
    useGlobalInterceptors: jest.fn(),
    useGlobalPipes: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
  };
}

function loadBootstrap(): () => Promise<void> {
  // Ensure module import never auto-runs bootstrap.
  process.env.NODE_ENV = 'test';

  const module = require('./main') as typeof import('./main');
  return module.bootstrap;
}

describe('main bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.E2E_TEST_OTP;
    delete process.env.FRONTEND_URL;
    delete process.env.PORT;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configures app and enables swagger in non-production', async () => {
    const app = createAppMock();
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.PORT = '3100';

    const { NestFactory } =
      require('@nestjs/core') as typeof import('@nestjs/core');

    const expressModule = require('express') as { default: { raw: jest.Mock } };
    const cookieParserModule = require('cookie-parser') as {
      default: jest.Mock;
    };

    const helmetModule = require('helmet') as { default: jest.Mock };

    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const bootstrap = loadBootstrap();
    process.env.NODE_ENV = 'development';
    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledWith(expect.any(Function), {
      rawBody: true,
    });
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    expect(expressModule.default.raw).toHaveBeenCalledWith({
      type: 'application/json',
    });
    expect(app.use).toHaveBeenCalledWith(
      '/api/v1/payments/webhook',
      'raw-webhook-middleware',
    );
    expect(cookieParserModule.default).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith('cookie-parser-middleware');
    expect(helmetModule.default).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith('helmet-middleware');
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:3000',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    });
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
    expect(app.useGlobalInterceptors).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(swaggerCreateDocument).toHaveBeenCalledTimes(1);
    expect(swaggerSetup).toHaveBeenCalledWith('api/docs', app, {
      openapi: '3.0.0',
    });
    expect(app.listen).toHaveBeenCalledWith('3100');
  });

  it('configures CORS with empty origin when FRONTEND_URL is missing', async () => {
    const app = createAppMock();
    process.env.FRONTEND_URL = '';

    const { NestFactory } =
      require('@nestjs/core') as typeof import('@nestjs/core');
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const bootstrap = loadBootstrap();
    process.env.NODE_ENV = 'development';
    await bootstrap();

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: '',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    });
  });

  it('aborts in production when E2E_TEST_OTP is configured', async () => {
    const app = createAppMock();
    process.env.FRONTEND_URL = 'https://app.buildmart.in';
    process.env.E2E_TEST_OTP = '123456';

    const { NestFactory } =
      require('@nestjs/core') as typeof import('@nestjs/core');
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    const bootstrap = loadBootstrap();
    process.env.NODE_ENV = 'production';
    await bootstrap();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(swaggerCreateDocument).not.toHaveBeenCalled();
    expect(app.setGlobalPrefix).not.toHaveBeenCalled();
  });

  it('does not configure swagger in production', async () => {
    const app = createAppMock();
    process.env.FRONTEND_URL = 'https://app.buildmart.in';
    process.env.E2E_TEST_OTP = '';

    const { NestFactory } =
      require('@nestjs/core') as typeof import('@nestjs/core');
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const bootstrap = loadBootstrap();
    process.env.NODE_ENV = 'production';
    expect(process.env.E2E_TEST_OTP).toBe('');
    await bootstrap();

    expect(swaggerCreateDocument).not.toHaveBeenCalled();
    expect(swaggerSetup).not.toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith('3001');
  });
});
