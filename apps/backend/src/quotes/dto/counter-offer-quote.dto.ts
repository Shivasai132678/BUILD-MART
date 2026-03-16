import { IsString, IsOptional, Matches } from 'class-validator';

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

export class CounterOfferQuoteDto {
  @IsString()
  @Matches(DECIMAL_REGEX, { message: 'counterOfferPrice must be a decimal string with up to 2 decimal places' })
  counterOfferPrice: string;

  @IsOptional()
  @IsString()
  counterOfferNote?: string;
}
