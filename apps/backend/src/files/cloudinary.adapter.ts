import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

@Injectable()
export class CloudinaryAdapter {
  private readonly logger = new Logger(CloudinaryAdapter.name);
  private readonly privateFolder: string;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ConfigurationError(
        'Cloudinary configuration is missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    this.privateFolder =
      this.configService.get<string>('CLOUDINARY_PRIVATE_FOLDER') ??
      'buildmart-vendor-docs';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async uploadFile(filePath: string, folder?: string): Promise<string> {
    try {
      const uploadResult = await cloudinary.uploader.upload(filePath, {
        folder: folder ?? this.privateFolder,
        resource_type: 'auto',
      });

      if (!uploadResult.secure_url) {
        throw new Error('Cloudinary upload did not return secure_url');
      }

      return uploadResult.secure_url;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Cloudinary upload error';
      this.logger.error(`Cloudinary upload failed for filePath=${filePath}: ${message}`);
      throw error;
    }
  }

  getPrivateFolder(): string {
    return this.privateFolder;
  }
}
