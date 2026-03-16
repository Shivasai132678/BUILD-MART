import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditAction =
  | 'VENDOR_APPROVED'
  | 'VENDOR_REJECTED'
  | 'VENDOR_SUSPENDED'
  | 'ORDER_FORCE_CANCELLED'
  | 'ORDER_FLAGGED'
  | 'ADMIN_FORCE_CANCEL_ORDER'
  | 'ADMIN_FLAG_ORDER';

export type CreateAuditLogDto = {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an immutable audit entry. Failures are swallowed and logged so that
   * a non-critical audit write never breaks a business-critical operation.
   */
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: dto.userId ?? null,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          oldValue: dto.oldValue != null ? (dto.oldValue as unknown as Prisma.InputJsonValue) : undefined,
          newValue: dto.newValue != null ? (dto.newValue as unknown as Prisma.InputJsonValue) : undefined,
          ipAddress: dto.ipAddress ?? null,
        },
      });

      this.logger.log(
        `Audit: action=${dto.action} entity=${dto.entityType}:${dto.entityId} by userId=${dto.userId ?? 'system'}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to write audit log action=${dto.action} entity=${dto.entityType}:${dto.entityId}: ${message}`,
      );
    }
  }
}
