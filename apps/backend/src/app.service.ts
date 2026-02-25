import { Injectable } from '@nestjs/common';

type HealthStatusResponse = {
  status: 'ok';
  service: 'buildmart-backend';
};

@Injectable()
export class AppService {
  getHealth(): HealthStatusResponse {
    return {
      status: 'ok',
      service: 'buildmart-backend',
    };
  }
}
