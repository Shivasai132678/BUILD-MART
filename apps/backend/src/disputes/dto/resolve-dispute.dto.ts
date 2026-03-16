import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DisputeStatus } from '@prisma/client';

const ALLOWED_RESOLVE_STATUSES = [DisputeStatus.RESOLVED, DisputeStatus.CLOSED] as const;
type ResolveStatus = (typeof ALLOWED_RESOLVE_STATUSES)[number];

export class ResolveDisputeDto {
  @IsEnum(ALLOWED_RESOLVE_STATUSES)
  @IsOptional()
  status?: ResolveStatus = DisputeStatus.RESOLVED;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  adminNotes?: string;
}
