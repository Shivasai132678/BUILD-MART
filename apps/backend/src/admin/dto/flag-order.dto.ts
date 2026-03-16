import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FlagOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  @MaxLength(500, { message: 'Reason must be 500 characters or fewer' })
  reason!: string;
}
