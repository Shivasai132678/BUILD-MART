/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/unbound-method */

const nestCreate = jest.fn();
const createDocument = jest.fn(() => ({ openapi: '3.0.0' }));
const mkdirSync = jest.fn();
const writeFileSync = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: nestCreate,
  },
}));

jest.mock('@nestjs/swagger', () => {
  const actualSwagger =
    jest.requireActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');

  return {
    ...actualSwagger,
    SwaggerModule: {
      createDocument,
    },
  };
});

jest.mock('node:fs', () => {
  const actualFs = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...actualFs,
    mkdirSync,
    writeFileSync,
  };
});

describe('generate-openapi', () => {
  let originalSkipDbConnect: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalSkipDbConnect = process.env.SKIP_DB_CONNECT;
  });

  afterEach(() => {
    if (originalSkipDbConnect === undefined) {
      delete process.env.SKIP_DB_CONNECT;
    } else {
      process.env.SKIP_DB_CONNECT = originalSkipDbConnect;
    }
  });

  it('writes OpenAPI JSON and closes application context', async () => {
    const setGlobalPrefix = jest.fn();
    const enableVersioning = jest.fn();
    const close = jest.fn().mockResolvedValue(undefined);
    nestCreate.mockResolvedValue({ setGlobalPrefix, enableVersioning, close });

    const { generateOpenApiSpec } = require('./generate-openapi') as typeof import('./generate-openapi');

    const outputPath = '/tmp/openapi-test.json';
    const writtenPath = await generateOpenApiSpec({ outputPath });

    expect(writtenPath).toBe(outputPath);
    expect(setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(enableVersioning).toHaveBeenCalledWith(
      expect.objectContaining({ defaultVersion: '1' }),
    );
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(mkdirSync).toHaveBeenCalledWith('/tmp', { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      outputPath,
      '{\n  "openapi": "3.0.0"\n}\n',
      'utf8',
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('sets SKIP_DB_CONNECT=true when missing', async () => {
    jest.resetModules();
    const setGlobalPrefix = jest.fn();
    const enableVersioning = jest.fn();
    const close = jest.fn().mockResolvedValue(undefined);
    nestCreate.mockResolvedValue({ setGlobalPrefix, enableVersioning, close });
    delete process.env.SKIP_DB_CONNECT;

    const { generateOpenApiSpec } = require('./generate-openapi') as typeof import('./generate-openapi');

    await generateOpenApiSpec({ outputPath: '/tmp/openapi-env.json' });

    expect(process.env.SKIP_DB_CONNECT).toBe('true');
  });
});
