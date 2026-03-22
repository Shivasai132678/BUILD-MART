/* eslint-disable @typescript-eslint/no-require-imports */

const existsSync = jest.fn();
const readFileSync = jest.fn();
const generateOpenApiSpec = jest.fn();

jest.mock('node:fs', () => ({
  existsSync,
  readFileSync,
}));

jest.mock('./generate-openapi', () => ({
  generateOpenApiSpec,
}));

describe('check-openapi-drift', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when generated OpenAPI matches tracked file', async () => {
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue('{"openapi":"3.0.0"}\n');
    generateOpenApiSpec.mockResolvedValue('/tmp/openapi.json');

    const { checkOpenApiDrift } = require('./check-openapi-drift') as typeof import('./check-openapi-drift');

    await expect(checkOpenApiDrift()).resolves.toBeUndefined();
    expect(generateOpenApiSpec).toHaveBeenCalledTimes(1);
  });

  it('fails when docs/openapi.json is missing', async () => {
    existsSync.mockReturnValue(false);

    const { checkOpenApiDrift } = require('./check-openapi-drift') as typeof import('./check-openapi-drift');

    await expect(checkOpenApiDrift()).rejects.toThrow(
      'docs/openapi.json is missing. Run pnpm docs:openapi to generate it.',
    );
    expect(generateOpenApiSpec).not.toHaveBeenCalled();
  });

  it('fails when generated OpenAPI differs from tracked file', async () => {
    existsSync.mockReturnValue(true);
    readFileSync
      .mockReturnValueOnce('{"version":"old"}\n')
      .mockReturnValueOnce('{"version":"new"}\n');
    generateOpenApiSpec.mockResolvedValue('/tmp/openapi.json');

    const { checkOpenApiDrift } = require('./check-openapi-drift') as typeof import('./check-openapi-drift');

    await expect(checkOpenApiDrift()).rejects.toThrow(
      'OpenAPI drift detected. Run pnpm docs:openapi and commit docs/openapi.json.',
    );
  });
});
