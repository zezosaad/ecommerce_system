import { Injectable } from '@nestjs/common';
import { AuthContextService } from '../auth/auth-context.service';
import { EffectivePermissionsService } from '../auth/effective-permissions.service';
import type { RoleDto, AccessScopeDto } from '@vendorhub/types';

@Injectable()
export class MeService {
  constructor(
    private authContextService: AuthContextService,
    private effectivePermissionsService: EffectivePermissionsService,
  ) {}

  async getPermissions(userId: string): Promise<{
    permissions: string[];
    isSuperAdmin: boolean;
  }> {
    const result = await this.effectivePermissionsService.getForUser(userId);
    return {
      permissions: Array.from(result.permissions),
      isSuperAdmin: result.isSuperAdmin,
    };
  }

  async getRoles(userId: string): Promise<RoleDto[]> {
    const authContext = await this.authContextService.resolveById(userId);

    return authContext.roles.map((r) => ({
      id: r.id,
      key: r.code,
      label: r.label as { en: string; ar: string },
      description: r.description as { en: string; ar: string } | null,
      isSystem: r.isSystem,
    }));
  }

  async getAccessScope(userId: string): Promise<AccessScopeDto[]> {
    const authContext = await this.authContextService.resolveById(userId);

    return authContext.accessScopes.map((s) => ({
      scopeType: s.scopeType as 'platform' | 'merchant' | 'store',
      merchantId: s.merchantId,
      storeId: s.storeId,
    }));
  }
}
