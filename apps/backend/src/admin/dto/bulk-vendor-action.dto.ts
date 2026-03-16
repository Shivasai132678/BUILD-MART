import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class BulkVendorActionDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  vendorIds: string[];
}
