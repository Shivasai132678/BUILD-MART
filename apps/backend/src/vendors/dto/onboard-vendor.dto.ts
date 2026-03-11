import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export const GST_NUMBER_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export class OnboardVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName!: string;

  @IsString()
  @Matches(GST_NUMBER_REGEX, {
    message:
      'gstNumber must be a valid Indian GSTIN (e.g. 29ABCDE1234F1Z5)',
  })
  gstNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  serviceableAreas!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsUrl()
  gstDocumentUrl?: string;

  @IsOptional()
  @IsUrl()
  businessLicenseUrl?: string;
}
