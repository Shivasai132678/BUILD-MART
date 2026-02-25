import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  getHealth() {
    return this.appService.getHealth();
  }

  @Get()
  @Version('1')
  getHealthV1() {
    return this.appService.getHealth();
  }
}
