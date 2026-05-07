export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
export type ScopeType = 'platform' | 'merchant' | 'store';
export type Locale = 'en' | 'ar';
export type Localized<T = string> = { en: T; ar: T };

export interface UserProfileDto {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  preferredLanguage: Locale;
  defaultCurrency: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  id: string;
  key: string;
  label: Localized;
  description: Localized | null;
  isSystem: boolean;
}

export interface PermissionDto {
  id: string;
  key: string;
  module: string;
  resource: string;
  action: string;
  label: Localized;
  description: Localized | null;
}

export interface AccessScopeDto {
  scopeType: ScopeType;
  merchantId: string | null;
  storeId: string | null;
}

export interface AuthEnvelopeDto {
  user: UserProfileDto;
  roles: RoleDto[];
  permissions: string[];
  accessScopes: AccessScopeDto[];
  isSuperAdmin: boolean;
}

export interface AuditLogDto {
  id: string;
  occurredAt: string;
  actor: { id: string; email: string } | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  merchantId: string | null;
  storeId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: 'info' | 'notice' | 'warning' | 'critical';
}
