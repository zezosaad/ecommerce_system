import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserAccessScope } from '@prisma/client';

@Injectable()
export class ScopeProjectorService {
  private readonly logger = new Logger(ScopeProjectorService.name);

  constructor(private prisma: PrismaService) {}

  async rebuildForUser(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserAccessScope[]> {
    const client = tx ?? this.prisma;

    await client.userAccessScope.deleteMany({ where: { userId } });

    const userRoles = await client.userRole.findMany({
      where: { userId, revokedAt: null },
      select: { merchantId: true, storeId: true },
    });

    const scopesToInsert = new Set<string>();
    const rows: Omit<UserAccessScope, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const ur of userRoles) {
      if (ur.merchantId) {
        const merchantKey = `merchant:${ur.merchantId}`;
        if (!scopesToInsert.has(merchantKey)) {
          scopesToInsert.add(merchantKey);
          rows.push({
            userId,
            scopeType: 'merchant',
            merchantId: ur.merchantId,
            storeId: null,
            source: 'role',
          });
        }
      }

      if (ur.storeId) {
        const storeKey = `store:${ur.merchantId ?? ''}:${ur.storeId}`;
        if (!scopesToInsert.has(storeKey)) {
          scopesToInsert.add(storeKey);
          rows.push({
            userId,
            scopeType: 'store',
            merchantId: ur.merchantId,
            storeId: ur.storeId,
            source: 'role',
          });
        }
      }

      if (!ur.merchantId && !ur.storeId) {
        const platformKey = 'platform';
        if (!scopesToInsert.has(platformKey)) {
          scopesToInsert.add(platformKey);
          rows.push({
            userId,
            scopeType: 'platform',
            merchantId: null,
            storeId: null,
            source: 'role',
          });
        }
      }
    }

    const staffMemberships = await client.staffMembership.findMany({
      where: { userId, status: 'active' },
      select: { merchantId: true, storeId: true },
    });

    for (const sm of staffMemberships) {
      const merchantKey = `staff-merchant:${sm.merchantId}`;
      if (!scopesToInsert.has(merchantKey)) {
        scopesToInsert.add(merchantKey);
        rows.push({
          userId,
          scopeType: 'merchant',
          merchantId: sm.merchantId,
          storeId: null,
          source: 'staff_membership',
        });
      }

      if (sm.storeId) {
        const storeKey = `staff-store:${sm.merchantId}:${sm.storeId}`;
        if (!scopesToInsert.has(storeKey)) {
          scopesToInsert.add(storeKey);
          rows.push({
            userId,
            scopeType: 'store',
            merchantId: sm.merchantId,
            storeId: sm.storeId,
            source: 'staff_membership',
          });
        }
      }
    }

    const created: UserAccessScope[] = [];
    for (const row of rows) {
      const createdRow = await client.userAccessScope.create({ data: row });
      created.push(createdRow);
    }

    this.logger.log(`Rebuilt ${created.length} access scopes for user ${userId}`);
    return created;
  }

  async removeRowsBySource(
    userId: string,
    source: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.userAccessScope.deleteMany({ where: { userId, source } });
  }
}
