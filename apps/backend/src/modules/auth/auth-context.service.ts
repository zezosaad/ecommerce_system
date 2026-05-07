import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';
import { RoleCode, UserStatus } from '@vendorhub/types';

export interface AuthContext {
  userId: string;
  supabaseUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  preferredLanguage: string;
  defaultCurrency: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    code: string;
    label: unknown;
    description: unknown;
    isSystem: boolean;
    merchantId: string | null;
    storeId: string | null;
  }>;
  permissions: string[];
  accessScopes: Array<{
    scopeType: string;
    merchantId: string | null;
    storeId: string | null;
  }>;
}

const BLOCKED_STATUSES: UserStatus[] = ['suspended', 'deleted', 'inactive'];

export interface ResolveOptions {
  /** Permit users who do not yet have an application profile or any roles. */
  allowProfileless?: boolean;
  /** Permit users whose profile status is `pending_verification`. */
  allowPendingVerification?: boolean;
}

@Injectable()
export class AuthContextService {
  private readonly logger = new Logger(AuthContextService.name);

  constructor(private prisma: PrismaService) {}

  async resolveById(
    userId: string,
    options: ResolveOptions = {},
  ): Promise<AuthContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
      });
    }

    return this.buildContext(user, options);
  }

  private async buildContext(
    user: {
      id: string;
      supabaseUserId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
      phone: string | null;
      preferredLanguage: string;
      defaultCurrency: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    },
    options: ResolveOptions = {},
  ): Promise<AuthContext> {
    if (BLOCKED_STATUSES.includes(user.status as UserStatus)) {
      throw new ForbiddenException({
        code: 'AUTHZ_PROFILE_BLOCKED' as ErrorCode,
        message: `User account is ${user.status}.`,
      });
    }

    if (
      user.status === 'pending_verification' &&
      !options.allowPendingVerification
    ) {
      throw new ForbiddenException({
        code: 'AUTHZ_PROFILE_PENDING_VERIFICATION' as ErrorCode,
        message:
          'Account is pending email verification. Limited endpoints available.',
      });
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id, revokedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    if (userRoles.length === 0 && !options.allowProfileless) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_NO_ROLES_ASSIGNED,
        message: 'User has no roles assigned.',
      });
    }

    const roles = userRoles.map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
      label: ur.role.label,
      description: ur.role.description,
      isSystem: ur.role.isSystem,
      merchantId: ur.merchantId,
      storeId: ur.storeId,
    }));

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    const accessScopes = await this.prisma.userAccessScope.findMany({
      where: { userId: user.id },
    });

    return {
      userId: user.id,
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      defaultCurrency: user.defaultCurrency,
      status: user.status as UserStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles,
      permissions: Array.from(permissionSet),
      accessScopes: accessScopes.map((s) => ({
        scopeType: s.scopeType,
        merchantId: s.merchantId,
        storeId: s.storeId,
      })),
    };
  }

  async resolve(
    sub: string,
    email?: string,
    options: ResolveOptions = {},
  ): Promise<AuthContext> {
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseUserId: sub,
        deletedAt: null,
      },
    });

    let resolvedUser = user;

    if (!resolvedUser) {
      // Auto-provision is intentionally lightweight: a customer profile in
      // pending_verification, with the customer role attached. Webhook +
      // sync-profile will reconcile to active. If the route doesn't allow
      // profileless callers, buildContext below will reject anyway.
      resolvedUser = await this.prisma.user.create({
        data: {
          supabaseUserId: sub,
          email: email ?? `pending-${sub}@local.invalid`,
          preferredLanguage: 'en',
          status: 'pending_verification',
        },
      });

      const customerRole = await this.prisma.role.findUnique({
        where: { code: RoleCode.CUSTOMER },
      });
      if (customerRole) {
        await this.prisma.userRole.create({
          data: {
            userId: resolvedUser.id,
            roleId: customerRole.id,
          },
        });
      }

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

    return this.buildContext(resolvedUser, options);
  }
}
