import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';
import type { PermissionDto, Localized } from '@vendorhub/types';

export interface GroupedPermission {
  module: string;
  label: Localized;
  resources: {
    resource: string;
    label: Localized;
    permissions: PermissionDto[];
  }[];
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private prisma: PrismaService) {}

  async list(module?: string, pagination?: PaginationDto): Promise<{ data: PermissionDto[]; total: number }> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.page_size ?? 20;

    const where = module ? { module } : {};

    const [permissions, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      data: permissions.map(p => ({
        id: p.id,
        key: p.code,
        module: p.module,
        resource: p.resource,
        action: p.action,
        label: p.label as Localized,
        description: p.description as Localized | null,
      })),
      total,
    };
  }

  async grouped(): Promise<GroupedPermission[]> {
    const permissions = await this.prisma.permission.findMany();
    const moduleMap: Map<string, { label: Localized; resources: Map<string, { label: Localized; permissions: PermissionDto[] }> }> = new Map();

    for (const p of permissions) {
      if (!moduleMap.has(p.module)) {
        moduleMap.set(p.module, {
          label: { en: p.module, ar: p.module },
          resources: new Map(),
        });
      }

      const mod = moduleMap.get(p.module)!;
      if (!mod.resources.has(p.resource)) {
        mod.resources.set(p.resource, {
          label: { en: p.resource, ar: p.resource },
          permissions: [],
        });
      }

      mod.resources.get(p.resource)!.permissions.push({
        id: p.id,
        key: p.code,
        module: p.module,
        resource: p.resource,
        action: p.action,
        label: p.label as Localized,
        description: p.description as Localized | null,
      });
    }

    return Array.from(moduleMap.entries()).map(([module, mod]) => ({
      module,
      label: mod.label,
      resources: Array.from(mod.resources.entries()).map(([resource, res]) => ({
        resource,
        label: res.label,
        permissions: res.permissions,
      })),
    }));
  }
}
