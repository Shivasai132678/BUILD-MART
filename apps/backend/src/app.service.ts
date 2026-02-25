import { Injectable } from '@nestjs/common';

type HealthStatusResponse = {
  status: 'ok';
  timestamp: string;
};

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthStatusResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
