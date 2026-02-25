import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VendorModule } from './vendors/vendor.module';

@Module({
  imports: [VendorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
