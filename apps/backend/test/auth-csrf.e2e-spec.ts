import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth CSRF (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB_CONNECT = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-csrf-jwt-secret';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
    process.env.FRONTEND_URL =
      process.env.FRONTEND_URL ?? 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();
  });

  afterAll(async () => {
    delete process.env.SKIP_DB_CONNECT;
    await app.close();
  });

  it('blocks logout when access_token cookie exists but csrf token is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'access_token=dummy.jwt.token')
      .expect(403);
  });

  it('does not bypass csrf check with trusted origin alone', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'access_token=dummy.jwt.token')
      .expect(403);
  });

  it('allows logout when csrf cookie and x-csrf-token header match', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', ['access_token=dummy.jwt.token', 'csrf_token=csrf-e2e-1'])
      .set('X-CSRF-Token', 'csrf-e2e-1')
      .expect(200);
  });
});
