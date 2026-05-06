'use client';

import React from 'react';

interface PermissionContextValue {
  permissions: string[];
}

const PermissionContext = React.createContext<PermissionContextValue>({
  permissions: [],
});

export function PermissionProvider({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions: string[];
}) {
  return (
    <PermissionContext.Provider value={{ permissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(code: string): boolean {
  const { permissions } = React.useContext(PermissionContext);

  if (permissions.includes(code)) return true;

  const [scope, resource] = code.split('.');
  const wildcard = `${scope}.${resource}.*`;
  return permissions.includes(wildcard);
}

export function RequirePermission({
  children,
  code,
  fallback,
}: {
  children: React.ReactNode;
  code: string;
  fallback?: React.ReactNode;
}) {
  const hasPermission = usePermission(code);

  if (!hasPermission) {
    return <>{fallback ?? null}</>;
  }

  return <>{children}</>;
}
