import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.schema';

interface CacheEntry {
  permissions: Set<string>;
  isSuperAdmin: boolean;
  expiresAt: number;
}

@Injectable()
export class EffectivePermissionsService {
  private readonly logger = new Logger(EffectivePermissionsService.name);
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(
    private prisma: PrismaService,
    configService: ConfigService<EnvConfig>,
  ) {
    // FR-021: cap at 60s. Schema enforces max 60.
    this.ttlMs =
      (Number(configService.get('AUTH_PERMISSIONS_CACHE_TTL_SECONDS')) || 60) * 1000;
    this.maxEntries = Number(configService.get('AUTH_PERMISSIONS_CACHE_MAX')) || 1000;
  }

  /** Invalidate all cached entries (e.g. when seeded permissions change). */
  invalidateAll(): void {
    this.cache.clear();
  }

  /** Invalidate a list of users in one call (for batch ops). */
  invalidateMany(userIds: string[]): void {
    for (const userId of userIds) {
      this.cache.delete(userId);
    }
  }

  async getForUser(userId: string): Promise<{
    permissions: Set<string>;
    isSuperAdmin: boolean;
  }> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return { permissions: new Set(cached.permissions), isSuperAdmin: cached.isSuperAdmin };
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, revokedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    let isSuperAdmin = false;
    const permissionSet = new Set<string>();

    for (const ur of userRoles) {
      if (ur.role.code === 'super_admin') {
        isSuperAdmin = true;
        break;
      }
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    if (isSuperAdmin) {
      permissionSet.add('*');
    }

    this.setCache(userId, permissionSet, isSuperAdmin);

    return { permissions: permissionSet, isSuperAdmin };
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  private setCache(userId: string, permissions: Set<string>, isSuperAdmin: boolean): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(userId, {
      permissions,
      isSuperAdmin,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}
