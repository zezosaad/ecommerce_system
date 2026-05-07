import type {
  AuthEnvelopeDto,
  UserProfileDto,
  RoleDto,
  PermissionDto,
  AccessScopeDto,
  AuditLogDto,
  ListEnvelope,
  SuccessEnvelope,
} from '@vendorhub/types';
import type { ApiClient } from './client';

export function createAuthClient(client: ApiClient) {
  return {
    me: (): Promise<SuccessEnvelope<AuthEnvelopeDto>> =>
      client.get<AuthEnvelopeDto>('/api/v1/auth/me'),
    syncProfile: (body: { email?: string; firstName?: string; lastName?: string }): Promise<SuccessEnvelope<AuthEnvelopeDto>> =>
      client.post<AuthEnvelopeDto>('/api/v1/auth/sync-profile', body),
    updateProfile: (body: { firstName?: string; lastName?: string; phone?: string; avatarUrl?: string; preferredLanguage?: string; defaultCurrency?: string }): Promise<SuccessEnvelope<UserProfileDto>> =>
      client.patch<UserProfileDto>('/api/v1/auth/profile', body),
    logout: async (): Promise<void> => {
      await client.post<never>('/api/v1/auth/logout');
    },
  };
}

export function createUsersClient(client: ApiClient) {
  return {
    list: (params?: { page?: number; pageSize?: number; q?: string; status?: string; roleKey?: string; merchantId?: string; storeId?: string }): Promise<ListEnvelope<UserProfileDto & { roles: RoleDto[] }>> => {
      const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v!)])) : '';
      return client.getList<UserProfileDto & { roles: RoleDto[] }>(`/api/v1/users${qs}`);
    },
    getById: (id: string): Promise<SuccessEnvelope<UserProfileDto & { roles: RoleDto[]; accessScopes: AccessScopeDto[] }>> =>
      client.get<UserProfileDto & { roles: RoleDto[]; accessScopes: AccessScopeDto[] }>(`/api/v1/users/${id}`),
    updateStatus: (id: string, body: { status: string; reason?: string }): Promise<SuccessEnvelope<UserProfileDto>> =>
      client.patch<UserProfileDto>(`/api/v1/users/${id}/status`, body),
    updateRoles: (id: string, body: { roleIds: string[] }): Promise<SuccessEnvelope<UserProfileDto & { roles: RoleDto[] }>> =>
      client.patch<UserProfileDto & { roles: RoleDto[] }>(`/api/v1/users/${id}/roles`, body),
  };
}

export function createRolesClient(client: ApiClient) {
  return {
    list: (): Promise<ListEnvelope<RoleDto>> =>
      client.getList<RoleDto>('/api/v1/roles'),
    create: (body: { key: string; label: { en: string; ar: string }; description?: { en: string; ar: string } }): Promise<SuccessEnvelope<RoleDto>> =>
      client.post<RoleDto>('/api/v1/roles', body),
    getById: (id: string): Promise<SuccessEnvelope<RoleDto>> =>
      client.get<RoleDto>(`/api/v1/roles/${id}`),
    update: (
      id: string,
      body: {
        label?: { en: string; ar: string };
        description?: { en: string; ar: string } | null;
        /** Replace the role's permission set with this list of permission keys. */
        permissions?: string[];
      },
    ): Promise<SuccessEnvelope<RoleDto>> =>
      client.patch<RoleDto>(`/api/v1/roles/${id}`, body),
    delete: async (id: string): Promise<void> => {
      await client.delete<never>(`/api/v1/roles/${id}`);
    },
  };
}

export function createPermissionsClient(client: ApiClient) {
  return {
    list: (module?: string): Promise<ListEnvelope<PermissionDto>> => {
      const qs = module ? `?module=${module}` : '';
      return client.getList<PermissionDto>(`/api/v1/permissions${qs}`);
    },
    grouped: (): Promise<SuccessEnvelope<Array<{ module: string; label: { en: string; ar: string }; resources: Array<{ resource: string; label: { en: string; ar: string }; permissions: PermissionDto[] }> }>>> =>
      client.get<Array<{ module: string; label: { en: string; ar: string }; resources: Array<{ resource: string; label: { en: string; ar: string }; permissions: PermissionDto[] }> }>>('/api/v1/permissions/grouped'),
  };
}

export function createMeClient(client: ApiClient) {
  return {
    permissions: (): Promise<SuccessEnvelope<string[]>> =>
      client.get<string[]>('/api/v1/me/permissions'),
    roles: (): Promise<SuccessEnvelope<RoleDto[]>> =>
      client.get<RoleDto[]>('/api/v1/me/roles'),
    accessScopes: (): Promise<SuccessEnvelope<AccessScopeDto[]>> =>
      client.get<AccessScopeDto[]>('/api/v1/me/access-scopes'),
  };
}

export function createAuditLogsClient(client: ApiClient) {
  return {
    list: (params?: { cursor?: string; pageSize?: number; actionCode?: string; actorUserId?: string; merchantId?: string; storeId?: string }): Promise<SuccessEnvelope<{ data: AuditLogDto[]; nextCursor?: string }>> => {
      const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v!)])) : '';
      return client.get<{ data: AuditLogDto[]; nextCursor?: string }>(`/api/v1/audit-logs${qs}`);
    },
    getById: (id: string): Promise<SuccessEnvelope<AuditLogDto>> =>
      client.get<AuditLogDto>(`/api/v1/audit-logs/${id}`),
  };
}
