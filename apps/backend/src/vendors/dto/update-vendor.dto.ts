import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { GST_NUMBER_REGEX } from './onboard-vendor.dto';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessName?: string;

  @IsOptional()
  @IsString()
  @Matches(GST_NUMBER_REGEX, {
    message:
      'gstNumber must be a valid Indian GSTIN (e.g. 29ABCDE1234F1Z5)',
  })
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  serviceableAreas?: string[];

  @IsOptional()
  @IsUrl()
  gstDocumentUrl?: string;

  @IsOptional()
  @IsUrl()
  businessLicenseUrl?: string;
}
