import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CloudinaryAdapter } from './cloudinary.adapter';
import { FilesController } from './files.controller';

@Module({
  imports: [MulterModule.register({})],
  controllers: [FilesController],
  providers: [CloudinaryAdapter],
  exports: [CloudinaryAdapter],
})
export class FilesModule {}
