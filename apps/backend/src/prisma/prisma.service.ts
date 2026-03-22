import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private hasConnected = false;

  constructor() {
    super({
      datasourceUrl: process.env.DATABASE_URL,
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') {
      this.logger.log('Skipping database connection (SKIP_DB_CONNECT=true)');
      return;
    }

    this.logger.log('Connecting to database…');
    await this.$connect();
    this.hasConnected = true;
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.hasConnected) {
      this.logger.log(
        'Skipping database disconnect (no active Prisma connection)',
      );
      return;
    }

    this.logger.log('Disconnecting from database…');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
