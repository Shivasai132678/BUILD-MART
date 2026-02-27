import { Module } from '@nestjs/common';
import { CloudinaryAdapter } from './cloudinary.adapter';

@Module({
  providers: [CloudinaryAdapter],
  exports: [CloudinaryAdapter],
})
export class FilesModule {}
