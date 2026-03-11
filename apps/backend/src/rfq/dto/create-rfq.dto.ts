import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateRfqItemDto } from './create-rfq-item.dto';

export class CreateRfqDto {
  @IsString()
  @IsNotEmpty()
  addressId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsString()
  @IsDateString()
  validUntil!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRfqItemDto)
  items!: CreateRfqItemDto[];
}
