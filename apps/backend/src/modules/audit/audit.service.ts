import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string;
  actorRoleCodes: string[];
  actionCode: string;
  targetType?: string;
  targetId?: string;
  merchantId?: string;
  storeId?: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  severity?: 'info' | 'warning' | 'critical';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async write(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          actorRoleCodes: entry.actorRoleCodes,
          actionCode: entry.actionCode,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          merchantId: entry.merchantId ?? null,
          storeId: entry.storeId ?? null,
          correlationId: entry.correlationId,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent
            ? entry.userAgent.substring(0, 512)
            : null,
          before: entry.before ?? undefined,
          after: entry.after ?? undefined,
          metadata: entry.metadata ?? undefined,
          severity: entry.severity ?? 'info',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log: ${(error as Error).message}`,
      );
    }
  }
}
