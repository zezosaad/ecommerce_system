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
  severity?: 'info' | 'notice' | 'warning' | 'critical';
}

export interface ListAuditLogsOptions {
  cursor?: string;
  pageSize?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  merchantId?: string;
  storeId?: string;
  from?: Date;
  to?: Date;
  severity?: string;
  /**
   * If provided, restricts results to rows whose `merchantId` is in this set
   * (or is null for platform-scoped entries the caller is allowed to see).
   * Set by the controller from the caller's access scopes for non-Super-Admin
   * users — Super Admin passes `undefined` to see everything.
   */
  allowedMerchantIds?: string[] | null;
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

  async list(options: ListAuditLogsOptions): Promise<{
    items: Array<Record<string, unknown>>;
    nextCursor: string | null;
  }> {
    const pageSize = options.pageSize ?? 20;
    const cursor = options.cursor;

    const where: Record<string, unknown> = {};
    if (options.actorUserId) where.actorUserId = options.actorUserId;
    if (options.action) where.actionCode = options.action;
    if (options.entityType) where.targetType = options.entityType;
    if (options.entityId) where.targetId = options.entityId;
    if (options.merchantId) where.merchantId = options.merchantId;
    if (options.storeId) where.storeId = options.storeId;
    if (options.severity) where.severity = options.severity;

    // FR-023/FR-026: non-super-admin callers see only rows in their merchant
    // scope. `allowedMerchantIds = []` means "no merchant scope at all" so
    // they only see platform-level (null merchantId) rows actor-attributed
    // to themselves.
    if (options.allowedMerchantIds !== undefined && options.allowedMerchantIds !== null) {
      const ids = options.allowedMerchantIds;
      where.OR = [
        { merchantId: { in: ids } },
        ...(options.actorUserId ? [{ actorUserId: options.actorUserId }] : []),
      ];
    }

    if (options.from || options.to) {
      where.occurredAt = {};
      if (options.from) (where.occurredAt as Record<string, unknown>).gte = options.from;
      if (options.to) (where.occurredAt as Record<string, unknown>).lte = options.to;
    }

    if (cursor) {
      // Cursor encodes (occurredAt, id). Order is (occurredAt DESC, id DESC),
      // so the next page must be strictly older than the cursor row.
      const [cursorOccurredAt, cursorId] = cursor.split('|');
      const cursorDate = new Date(cursorOccurredAt);
      where.AND = [
        ...((where.AND as unknown[]) ?? []),
        {
          OR: [
            { occurredAt: { lt: cursorDate } },
            { occurredAt: cursorDate, id: { lt: cursorId } },
          ],
        },
      ];
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      take: pageSize + 1,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });

    let nextCursor: string | null = null;
    if (items.length > pageSize) {
      items.pop();
      const last = items[items.length - 1];
      if (last) {
        nextCursor = `${last.occurredAt.toISOString()}|${last.id}`;
      }
    }

    return {
      items: items.map((item) => ({
        id: item.id,
        actorUserId: item.actorUserId,
        actorRoleCodes: item.actorRoleCodes,
        actionCode: item.actionCode,
        targetType: item.targetType,
        targetId: item.targetId,
        merchantId: item.merchantId,
        storeId: item.storeId,
        correlationId: item.correlationId,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        before: item.before,
        after: item.after,
        metadata: item.metadata,
        severity: item.severity,
        occurredAt: item.occurredAt,
      })),
      nextCursor,
    };
  }

  async getById(id: string): Promise<Record<string, unknown> | null> {
    const item = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!item) return null;

    return {
      id: item.id,
      actorUserId: item.actorUserId,
      actorRoleCodes: item.actorRoleCodes,
      actionCode: item.actionCode,
      targetType: item.targetType,
      targetId: item.targetId,
      merchantId: item.merchantId,
      storeId: item.storeId,
      correlationId: item.correlationId,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      before: item.before,
      after: item.after,
      metadata: item.metadata,
      severity: item.severity,
      occurredAt: item.occurredAt,
    };
  }
}
