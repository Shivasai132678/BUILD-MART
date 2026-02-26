import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateQuoteItemDto } from './create-quote-item.dto';

const DECIMAL_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  rfqId!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'subtotal must be a decimal string with up to 2 decimal places',
  })
  subtotal!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'taxAmount must be a decimal string with up to 2 decimal places',
  })
  taxAmount!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'deliveryFee must be a decimal string with up to 2 decimal places',
  })
  deliveryFee!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'totalAmount must be a decimal string with up to 2 decimal places',
  })
  totalAmount!: string;

  @IsString()
  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];
}
