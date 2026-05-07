import type { Translatable } from '@vendorhub/types';

export function resolveLocale(
  value: Translatable,
  locale: 'ar' | 'en',
  fallbacks?: ('ar' | 'en')[],
): string {
  const other: 'ar' | 'en' = locale === 'ar' ? 'en' : 'ar';
  const chain = fallbacks ?? [locale, other];
  for (const l of chain) {
    const candidate = value[l]?.trim();
    if (candidate && candidate.length > 0) {
      return candidate;
    }
  }
  return '';
}

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

export {
  parsePermissionKey,
  isValidPermissionKey,
  buildPermissionKey,
  SYSTEM_PERMISSIONS,
  type ParsedPermissionKey,
} from './permissions';
