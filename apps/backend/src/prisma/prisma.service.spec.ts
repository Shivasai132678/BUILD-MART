/* eslint-disable @typescript-eslint/unbound-method */
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips db connection when SKIP_DB_CONNECT=true', async () => {
    process.env.SKIP_DB_CONNECT = 'true';
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();

    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('connects to db when SKIP_DB_CONNECT is not set', async () => {
    delete process.env.SKIP_DB_CONNECT;
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });
});
