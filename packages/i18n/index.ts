import en from './en.json';
import ar from './ar.json';

export type MessageCatalog = Record<string, unknown>;

export const catalogs: Record<string, MessageCatalog> = { en, ar };

export function getMessage(locale: string, key: string): string {
  const catalog = catalogs[locale] ?? catalogs['en'];
  const value = key.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalog);

  return typeof value === 'string' ? value : key;
}

export { en, ar };
