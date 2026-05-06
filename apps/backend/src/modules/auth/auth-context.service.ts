import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';
import { RoleCode } from '@vendorhub/types';

export interface AuthContext {
  userId: string;
  supabaseUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
  roles: Array<{
    code: string;
    label: unknown;
    merchantId: string | null;
    storeId: string | null;
  }>;
  permissions: string[];
}

@Injectable()
export class AuthContextService {
  private readonly logger = new Logger(AuthContextService.name);

  constructor(private prisma: PrismaService) {}

  async resolve(sub: string, email?: string): Promise<AuthContext> {
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseUserId: sub,
        deletedAt: null,
      },
    });

    let resolvedUser = user;

    if (!resolvedUser) {
      resolvedUser = await this.prisma.user.create({
        data: {
          supabaseUserId: sub,
          email: email ?? 'unknown@example.com',
          locale: 'en',
          isActive: true,
        },
      });

      await this.prisma.userRole.create({
        data: {
          userId: resolvedUser.id,
          roleId: (
            await this.prisma.role.findUnique({ where: { code: RoleCode.CUSTOMER } })
          )!.id,
        },
      });

      this.logger.log(`Auto-provisioned user ${resolvedUser.id} with Customer role`);
    } else if (email && email !== resolvedUser.email) {
      resolvedUser = await this.prisma.user.update({
        where: { id: resolvedUser.id },
        data: { email, lastSeenAt: new Date() },
      });
    } else {
      resolvedUser = await this.prisma.user.update({
        where: { id: resolvedUser.id },
        data: { lastSeenAt: new Date() },
      });
    }

    if (!resolvedUser.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PROFILE_MISSING,
        message: 'User account is deactivated.',
      });
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: resolvedUser.id,
        revokedAt: null,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (userRoles.length === 0) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_NO_ROLES_ASSIGNED,
        message: 'User has no roles assigned.',
      });
    }

    const roles = userRoles.map((ur: (typeof userRoles)[number]) => ({
      code: ur.role.code,
      label: ur.role.label,
      merchantId: ur.merchantId,
      storeId: ur.storeId,
    }));

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    return {
      userId: resolvedUser.id,
      supabaseUserId: resolvedUser.supabaseUserId,
      email: resolvedUser.email,
      displayName: resolvedUser.displayName,
      avatarUrl: resolvedUser.avatarUrl,
      locale: resolvedUser.locale,
      isActive: resolvedUser.isActive,
      roles,
      permissions: Array.from(permissionSet),
    };
  }
}
