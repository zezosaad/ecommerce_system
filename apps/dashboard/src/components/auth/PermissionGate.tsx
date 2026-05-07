'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface PermissionGateProps {
  require: string | string[];
  permissions: string[];
  isSuperAdmin?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  require,
  permissions,
  isSuperAdmin = false,
  children,
  fallback,
}: PermissionGateProps) {
  const t = useTranslations('auth');
  const requiredKeys = Array.isArray(require) ? require : [require];

  const hasPermission =
    isSuperAdmin ||
    requiredKeys.every((key) => permissions.includes(key));

  if (!hasPermission) {
    return fallback !== undefined
      ? <>{fallback}</>
      : (
        <p className="text-sm text-gray-500 py-2">
          {t('permissionGate.notAuthorized')}
        </p>
      );
  }

  return <>{children}</>;
}
