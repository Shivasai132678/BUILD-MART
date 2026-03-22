import { ConfigService } from '@nestjs/config';

const uploadMock = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: (...args: unknown[]) => uploadMock(...args),
    },
  },
}));

describe('CloudinaryAdapter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('throws in production when required credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    const { CloudinaryAdapter } = require('./cloudinary.adapter') as {
      CloudinaryAdapter: new (config: ConfigService) => unknown;
    };

    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new CloudinaryAdapter(configService)).toThrow(
      'Cloudinary credentials are required in production',
    );
  });

  it('returns placeholder URL in non-production when not configured', async () => {
    process.env.NODE_ENV = 'test';
    const { CloudinaryAdapter } = require('./cloudinary.adapter') as {
      CloudinaryAdapter: new (config: ConfigService) => { uploadFile: (path: string) => Promise<string> };
    };

    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const adapter = new CloudinaryAdapter(configService);
    await expect(adapter.uploadFile('/tmp/doc.pdf')).resolves.toBe(
      'https://placeholder.dev/cloudinary-not-configured',
    );
  });

  it('uploads file and returns secure_url when configured', async () => {
    process.env.NODE_ENV = 'test';
    uploadMock.mockResolvedValue({ secure_url: 'https://cdn.example.com/file.pdf' });

    const { CloudinaryAdapter } = require('./cloudinary.adapter') as {
      CloudinaryAdapter: new (config: ConfigService) => {
        uploadFile: (path: string, folder?: string) => Promise<string>;
        getPrivateFolder: () => string;
      };
    };

    const configValues: Record<string, string> = {
      CLOUDINARY_CLOUD_NAME: 'cloud-name',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
      CLOUDINARY_PRIVATE_FOLDER: 'custom-folder',
    };

    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    const adapter = new CloudinaryAdapter(configService);
    await expect(adapter.uploadFile('/tmp/doc.pdf')).resolves.toBe(
      'https://cdn.example.com/file.pdf',
    );
    expect(adapter.getPrivateFolder()).toBe('custom-folder');
    expect(uploadMock).toHaveBeenCalledWith('/tmp/doc.pdf', {
      folder: 'custom-folder',
      resource_type: 'auto',
    });
  });

  it('throws when cloudinary upload does not return secure_url', async () => {
    process.env.NODE_ENV = 'test';
    uploadMock.mockResolvedValue({});

    const { CloudinaryAdapter } = require('./cloudinary.adapter') as {
      CloudinaryAdapter: new (config: ConfigService) => {
        uploadFile: (path: string, folder?: string) => Promise<string>;
      };
    };

    const configValues: Record<string, string> = {
      CLOUDINARY_CLOUD_NAME: 'cloud-name',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
    };

    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    const adapter = new CloudinaryAdapter(configService);
    await expect(adapter.uploadFile('/tmp/doc.pdf')).rejects.toThrow(
      'Cloudinary upload did not return secure_url',
    );
  });
});
