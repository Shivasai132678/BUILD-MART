import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;
}
