import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ManageVendorProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  productIds!: string[];
}
