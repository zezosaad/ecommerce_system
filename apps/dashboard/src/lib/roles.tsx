'use client';

import React from 'react';
import { Forbidden } from '../components/states/Forbidden';

const RoleContext = React.createContext<string[]>([]);

export function RoleProvider({ roleCodes, children }: { roleCodes: string[]; children: React.ReactNode }) {
  return <RoleContext.Provider value={roleCodes}>{children}</RoleContext.Provider>;
}

export function useRole(required: string): boolean {
  const roles = React.useContext(RoleContext);
  return roles.includes(required) || roles.includes('super_admin');
}

export function RequireRole({ required, children }: { required: string; children: React.ReactNode }) {
  const allowed = useRole(required);
  if (!allowed) {
    return <Forbidden title="Forbidden" message="You do not have access to this route." />;
  }
  return <>{children}</>;
}
