import { Injectable, Logger, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EffectivePermissionsService } from '../auth/effective-permissions.service';
import { ErrorCode } from '../common/errors/error-codes';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import type { RoleDto, PermissionDto, Localized } from '@vendorhub/types';
import type { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);
  private readonly SUPER_ADMIN_CODE = 'super_admin';

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private effectivePermissionsService: EffectivePermissionsService,
  ) {}

  async list(includePermissions: boolean = false): Promise<(RoleDto & { permissions?: string[] })[]> {
    const roles = await this.prisma.role.findMany({
      include: includePermissions ? { rolePermissions: { include: { permission: true } } } : undefined,
    });

    return roles.map((role) => {
      const withPerms = role as typeof role & {
        rolePermissions?: Array<{ permission: { code: string } }>;
      };
      return {
        id: role.id,
        key: role.code,
        label: role.label as Localized,
        description: role.description as Localized | null,
        isSystem: role.isSystem,
        ...(includePermissions
          ? {
              permissions:
                withPerms.rolePermissions?.map((rp) => rp.permission.code) ?? [],
            }
          : {}),
      };
    });
  }

  async getById(id: string, includePermissions: boolean = true): Promise<RoleDto & { permissions: PermissionDto[] }> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: includePermissions ? {
        rolePermissions: {
          include: { permission: true },
        },
      } : undefined,
    });

    if (!role) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Role not found',
      });
    }

    type LoadedPermission = {
      permission: {
        id: string;
        code: string;
        module: string;
        resource: string;
        action: string;
        label: unknown;
        description: unknown;
      };
    };
    const withPerms = role as typeof role & {
      rolePermissions?: LoadedPermission[];
    };
    return {
      id: role.id,
      key: role.code,
      label: role.label as Localized,
      description: role.description as Localized | null,
      isSystem: role.isSystem,
      permissions: includePermissions
        ? withPerms.rolePermissions?.map((rp) => ({
            id: rp.permission.id,
            key: rp.permission.code,
            module: rp.permission.module,
            resource: rp.permission.resource,
            action: rp.permission.action,
            label: rp.permission.label as Localized,
            description: rp.permission.description as Localized | null,
          })) ?? []
        : [],
    };
  }

  async create(dto: CreateRoleDto, actorId: string | undefined): Promise<RoleDto> {
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.key },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCode.RESOURCE_CONFLICT,
        message: 'Role key already exists',
      });
    }

    const role = await this.prisma.role.create({
      data: {
        code: dto.key,
        label: dto.label as Prisma.InputJsonValue,
        description: dto.description as Prisma.InputJsonValue | undefined,
        isSystem: false,
      },
    });

    if (dto.permissions && dto.permissions.length > 0) {
      await this.replacePermissions(role.id, dto.permissions, actorId);
    }

    await this.auditService.write({
      actorUserId: actorId,
      actorRoleCodes: [],
      actionCode: 'roles.created',
      targetType: 'Role',
      targetId: role.id,
      metadata: { key: role.code, label: role.label },
      correlationId: '',
    });

    this.logger.log(`Role created: ${role.code} by ${actorId}`);

    return this.getById(role.id, false);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string | undefined): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Role not found',
      });
    }

    if (role.isSystem && dto.label === undefined && dto.description === undefined && dto.permissions === undefined) {
      return this.getById(id, false);
    }

    if (role.code === this.SUPER_ADMIN_CODE && dto.permissions !== undefined) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Cannot modify permissions of super_admin role',
      });
    }

    const updateData: Prisma.RoleUpdateInput = {};
    if (dto.label !== undefined) updateData.label = dto.label as Prisma.InputJsonValue;
    if (dto.description !== undefined)
      updateData.description = dto.description as Prisma.InputJsonValue;

    await this.prisma.role.update({
      where: { id },
      data: updateData,
    });

    if (dto.permissions !== undefined) {
      await this.replacePermissions(id, dto.permissions, actorId);
    }

    await this.auditService.write({
      actorUserId: actorId,
      actorRoleCodes: [],
      actionCode: 'roles.updated',
      targetType: 'Role',
      targetId: id,
      metadata: { key: role.code, changes: dto },
      correlationId: '',
    });

    this.logger.log(`Role updated: ${role.code} by ${actorId}`);

    return this.getById(id, false);
  }

  async delete(id: string, actorId: string | undefined): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { userRoles: true },
    });

    if (!role) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Role not found',
      });
    }

    if (role.isSystem) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Cannot delete system role',
      });
    }

    if (role.code === this.SUPER_ADMIN_CODE) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Cannot delete super_admin role',
      });
    }

    if (role.userRoles.length > 0) {
      throw new ConflictException({
        code: ErrorCode.RESOURCE_CONFLICT,
        message: 'Cannot delete role that is assigned to users',
      });
    }

    await this.prisma.role.delete({ where: { id } });

    await this.auditService.write({
      actorUserId: actorId,
      actorRoleCodes: [],
      actionCode: 'roles.deleted',
      targetType: 'Role',
      targetId: id,
      metadata: { key: role.code },
      correlationId: '',
    });

    this.logger.log(`Role deleted: ${role.code} by ${actorId}`);
  }

  async replacePermissions(roleId: string, permissionKeys: string[], actorId: string | undefined): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Role not found',
      });
    }

    if (role.code === this.SUPER_ADMIN_CODE) {
      throw new ForbiddenException({
        code: ErrorCode.AUTHZ_PERMISSION_DENIED,
        message: 'Cannot modify permissions of super_admin role',
      });
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionKeys } },
    });

    const foundKeys = permissions.map(p => p.code);
    const missing = permissionKeys.filter(k => !foundKeys.includes(k));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Unknown permission keys: ${missing.join(', ')}`,
      });
    }

    const currentRolePerms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    const currentKeys = currentRolePerms.map(rp => rp.permission.code);
    const toAdd = permissionKeys.filter(k => !currentKeys.includes(k));
    const toRemove = currentRolePerms.filter(rp => !permissionKeys.includes(rp.permission.code));

    await this.prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { in: toRemove.map(rp => rp.permissionId) },
          },
        });

        await this.auditService.write({
          actorUserId: actorId,
          actorRoleCodes: [],
          actionCode: 'roles.permission_removed',
          targetType: 'Role',
          targetId: roleId,
          metadata: { removed: toRemove.map(rp => rp.permission.code) },
          correlationId: '',
        });
      }

      for (const key of toAdd) {
        const perm = permissions.find(p => p.code === key)!;
        await tx.rolePermission.create({
          data: { roleId, permissionId: perm.id },
        });
      }

      if (toAdd.length > 0) {
        await this.auditService.write({
          actorUserId: actorId,
          actorRoleCodes: [],
          actionCode: 'roles.permission_added',
          targetType: 'Role',
          targetId: roleId,
          metadata: { added: toAdd },
          correlationId: '',
        });
      }
    });

    const userIds = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    for (const { userId } of userIds) {
      await this.effectivePermissionsService.invalidate(userId);
    }

    this.logger.log(`Permissions updated for role ${role.code} by ${actorId}`);
  }
}
