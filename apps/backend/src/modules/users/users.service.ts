import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EffectivePermissionsService } from '../auth/effective-permissions.service';
import { ScopeProjectorService } from '../common/tenant/scope-projector.service';
import { ErrorCode } from '../common/errors/error-codes';
import type {
  UserStatus,
  AccessScopeDto,
  UserProfileDto,
  RoleDto,
  Localized,
} from '@vendorhub/types';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SUPER_ADMIN_CODE = 'super_admin';

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private effectivePermissionsService: EffectivePermissionsService,
    private scopeProjector: ScopeProjectorService,
  ) {}

  async list(dto: ListUsersDto): Promise<{ data: UserProfileDto[]; total: number }> {
    const page = dto.page ?? 1;
    const pageSize = dto.page_size ?? 20;

    const where: Prisma.UserWhereInput = {};

    if (dto.q) {
      where.OR = [
        { email: { contains: dto.q, mode: 'insensitive' } },
        { firstName: { contains: dto.q, mode: 'insensitive' } },
        { lastName: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    if (dto.status) {
      where.status = dto.status;
    }

    const scopeFilters: Prisma.UserWhereInput[] = [];
    if (dto.merchantId) {
      scopeFilters.push({ accessScopes: { some: { merchantId: dto.merchantId } } });
    }
    if (dto.storeId) {
      scopeFilters.push({ accessScopes: { some: { storeId: dto.storeId } } });
    }
    if (scopeFilters.length > 0) {
      const existing = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [...existing, ...scopeFilters];
    }

    if (dto.roleKey) {
      where.userRoles = { some: { role: { code: dto.roleKey } } };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page -1) * pageSize,
        take: pageSize,
        include: { userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(u => this.toProfileDto(u)),
      total,
    };
  }

  async getById(id: string): Promise<{
    user: UserProfileDto;
    roles: RoleDto[];
    accessScopes: AccessScopeDto[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        accessScopes: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
      });
    }

    return {
      user: this.toProfileDto(user),
      roles: user.userRoles.map(ur => ({
        id: ur.role.id,
        key: ur.role.code,
        label: ur.role.label as Localized,
        description: ur.role.description as Localized | null,
        isSystem: ur.role.isSystem,
      })),
      accessScopes: user.accessScopes.map(as => ({
        scopeType: as.scopeType as 'platform' | 'merchant' | 'store',
        merchantId: as.merchantId,
        storeId: as.storeId,
      })),
    };
  }

  async setStatus(
    userId: string,
    newStatus: UserStatus,
    actorId: string | undefined,
    reason?: string,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
      });
    }

    if (actorId === userId && newStatus !== user.status) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Cannot change your own status',
      });
    }

    const oldStatus = user.status;

    if (oldStatus === newStatus) {
      return this.toProfileDto(user);
    }

    if (newStatus === 'pending_verification') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Cannot manually set pending_verification status',
      });
    }

    // FR-014: protect last super-admin against any non-active status that
    // would lock them out of the platform.
    const userIsSuperAdmin = user.userRoles.some(
      (ur) => ur.role.code === this.SUPER_ADMIN_CODE,
    );
    if (userIsSuperAdmin && newStatus !== 'active') {
      const otherActiveSuperAdmins = await this.prisma.userRole.findMany({
        where: {
          role: { code: this.SUPER_ADMIN_CODE },
          userId: { not: userId },
          user: { status: 'active', deletedAt: null },
        },
        distinct: ['userId'],
        select: { userId: true },
      });
      if (otherActiveSuperAdmins.length === 0) {
        throw new ForbiddenException({
          code: ErrorCode.AUTHZ_PERMISSION_DENIED,
          message:
            'Cannot block the last active Super Admin (would lock the platform).',
        });
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    this.effectivePermissionsService.invalidate(userId);

    await this.auditService.write({
      actorUserId: actorId,
      actorRoleCodes: [],
      actionCode: 'auth.profile.status_changed',
      targetType: 'User',
      targetId: userId,
      correlationId: crypto.randomUUID(),
      metadata: { oldStatus, newStatus, reason },
    });

    this.logger.log(`User ${userId} status changed from ${oldStatus} to ${newStatus} by ${actorId}`);

    return this.toProfileDto(updatedUser);
  }

  async replaceRoles(
    userId: string,
    dto: UpdateUserRolesDto,
    actorId: string | undefined,
  ): Promise<{
    roles: RoleDto[];
    accessScopes: AccessScopeDto[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
      });
    }

    const currentRoleKeys = user.userRoles.map(ur => ur.role.code);
    const newRoleKeys = dto.assignments.map(a => a.roleKey);
    const uniqueNewKeys = [...new Set(newRoleKeys)];

    const roles = await this.prisma.role.findMany({
      where: { code: { in: uniqueNewKeys } },
    });

    const foundKeys = roles.map(r => r.code);
    const missing = uniqueNewKeys.filter(k => !foundKeys.includes(k));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Unknown role keys: ${missing.join(', ')}`,
      });
    }

    const currentAssignments = user.userRoles.map(ur => ({
      roleKey: ur.role.code,
      merchantId: ur.merchantId,
      storeId: ur.storeId,
    }));

    const newAssignments = dto.assignments;

    const added = newAssignments.filter(
      na => !currentAssignments.some(
        ca => ca.roleKey === na.roleKey && ca.merchantId === na.merchantId && ca.storeId === na.storeId
      )
    );

    const removed = currentAssignments.filter(
      ca => !newAssignments.some(
        na => na.roleKey === ca.roleKey && na.merchantId === ca.merchantId && na.storeId === ca.storeId
      )
    );

    const isLastSuperAdmin = currentRoleKeys.includes(this.SUPER_ADMIN_CODE) &&
      !newRoleKeys.includes(this.SUPER_ADMIN_CODE);

    if (isLastSuperAdmin) {
      // Count distinct super-admin USERS, not assignments. A single user with
      // multiple super_admin assignments at different scopes must not satisfy
      // the protection on its own.
      const otherSuperAdmins = await this.prisma.userRole.findMany({
        where: {
          role: { code: this.SUPER_ADMIN_CODE },
          userId: { not: userId },
          user: { deletedAt: null },
        },
        distinct: ['userId'],
        select: { userId: true },
      });

      if (otherSuperAdmins.length === 0) {
        throw new ForbiddenException({
          code: ErrorCode.AUTHZ_PERMISSION_DENIED,
          message: 'Cannot remove the last Super Admin role',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const rem of removed) {
        await tx.userRole.deleteMany({
          where: {
            userId,
            role: { code: rem.roleKey },
            merchantId: rem.merchantId,
            storeId: rem.storeId,
          },
        });
      }

      for (const add of added) {
        const role = roles.find(r => r.code === add.roleKey)!;
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
            merchantId: add.merchantId,
            storeId: add.storeId,
          },
        });
      }

      await this.scopeProjector.rebuildForUser(userId, tx);

      if (added.length > 0) {
        await this.auditService.write({
          actorUserId: actorId,
          actorRoleCodes: [],
          actionCode: 'users.role_assigned',
          targetType: 'User',
          targetId: userId,
          correlationId: crypto.randomUUID(),
          metadata: { added },
        });
      }

      if (removed.length > 0) {
        await this.auditService.write({
          actorUserId: actorId,
          actorRoleCodes: [],
          actionCode: 'users.role_removed',
          targetType: 'User',
          targetId: userId,
          correlationId: crypto.randomUUID(),
          metadata: { removed },
        });
      }
    });

    this.effectivePermissionsService.invalidate(userId);

    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        accessScopes: true,
      },
    });

    return {
      roles: updated!.userRoles.map(ur => ({
        id: ur.role.id,
        key: ur.role.code,
        label: ur.role.label as Localized,
        description: ur.role.description as Localized | null,
        isSystem: ur.role.isSystem,
      })),
      accessScopes: updated!.accessScopes.map(as => ({
        scopeType: as.scopeType as 'platform' | 'merchant' | 'store',
        merchantId: as.merchantId,
        storeId: as.storeId,
      })),
    };
  }

  private toProfileDto(user: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    preferredLanguage: string;
    defaultCurrency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage as 'en' | 'ar',
      defaultCurrency: user.defaultCurrency,
      status: user.status as UserStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
