import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRfqItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
