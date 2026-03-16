import { IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '@prisma/client';

export class ListDisputesDto {
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;
}
