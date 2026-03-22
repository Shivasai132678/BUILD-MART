import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';

type GenerateOpenApiSpecOptions = {
  outputPath?: string;
};

const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  'docs',
  'openapi.json',
);

export async function generateOpenApiSpec(
  options: GenerateOpenApiSpecOptions = {},
): Promise<string> {
  if (!process.env.SKIP_DB_CONNECT) {
    process.env.SKIP_DB_CONNECT = 'true';
  }

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  try {
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    const config = new DocumentBuilder()
      .setTitle('BuildMart API')
      .setDescription('BuildMart construction procurement platform API')
      .setVersion('1.0')
      .addCookieAuth(
        'access_token',
        { type: 'apiKey', in: 'cookie' },
        'access_token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;

    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    return outputPath;
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  generateOpenApiSpec().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to generate OpenAPI specification';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
