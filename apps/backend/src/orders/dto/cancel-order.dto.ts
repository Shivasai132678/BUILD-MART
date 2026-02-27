import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancelReason: string;
}
