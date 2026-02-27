import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' }),
  );
  app.use(helmet());

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    logger.error(
      'FRONTEND_URL is not set — CORS will block all browser requests!',
    );
  } else {
    logger.log(`CORS origin: ${frontendUrl}`);
  }
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('BuildMart API')
      .setDescription('BuildMart construction procurement platform API')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs (non-production only)');
  }

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
