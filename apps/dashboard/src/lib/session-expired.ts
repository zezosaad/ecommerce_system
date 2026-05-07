'use client';

import { registerSessionExpiredCallback } from '@vendorhub/api-client';

const SUPPORTED_LOCALES = ['en', 'ar'];

function detectLocale(pathname: string): string {
  const seg = pathname.split('/')[1];
  return SUPPORTED_LOCALES.includes(seg) ? seg : 'en';
}

export function registerDashboardSessionExpiredHandler(): void {
  registerSessionExpiredCallback(() => {
    const path = window.location.pathname + window.location.search;
    const locale = detectLocale(window.location.pathname);
    // Route group `(auth)` is stripped from URLs at runtime — the actual
    // login URL is `/<locale>/login`, NOT `/<locale>/(auth)/login`.
    window.location.href = `/${locale}/login?return=${encodeURIComponent(path)}`;
  });
}
