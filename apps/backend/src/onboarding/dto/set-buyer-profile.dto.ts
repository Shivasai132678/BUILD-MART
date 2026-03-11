import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetBuyerProfileDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;
}
