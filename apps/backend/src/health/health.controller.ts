import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { AppService } from '../app.service';

@Controller('health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  getHealth() {
    return this.appService.getHealth();
  }
}
