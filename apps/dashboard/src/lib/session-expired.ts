'use client';

import { registerSessionExpiredCallback } from '@vendorhub/api-client';

export function registerDashboardSessionExpiredHandler(): void {
  registerSessionExpiredCallback(() => {
    const current = window.location.pathname + window.location.search;
    window.location.href = `/en/(auth)/login?return=${encodeURIComponent(current)}`;
  });
}
