import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
