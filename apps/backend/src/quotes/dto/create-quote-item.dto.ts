import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const DECIMAL_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

export class CreateQuoteItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'quantity must be a decimal string with up to 2 decimal places',
  })
  quantity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'unitPrice must be a decimal string with up to 2 decimal places',
  })
  unitPrice!: string;

  @IsString()
  @Matches(DECIMAL_STRING_REGEX, {
    message: 'subtotal must be a decimal string with up to 2 decimal places',
  })
  subtotal!: string;
}
