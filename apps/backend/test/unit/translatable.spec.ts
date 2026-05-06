import { describe, it, expect } from 'vitest';
import { resolveLocale } from '@vendorhub/shared';

describe('resolveLocale (research R4 / FR-I18N-002)', () => {
  it('returns the requested locale when present', () => {
    expect(resolveLocale({ ar: 'مرحبا', en: 'Hello' }, 'ar')).toBe('مرحبا');
    expect(resolveLocale({ ar: 'مرحبا', en: 'Hello' }, 'en')).toBe('Hello');
  });

  it('falls back to the other locale when the preferred one is empty', () => {
    expect(resolveLocale({ ar: '', en: 'Hello' }, 'ar')).toBe('Hello');
    expect(resolveLocale({ ar: 'مرحبا', en: '' }, 'en')).toBe('مرحبا');
  });

  it('treats whitespace-only values as missing', () => {
    expect(resolveLocale({ ar: '   ', en: 'Hello' }, 'ar')).toBe('Hello');
  });

  it('returns empty string when both locales are empty (UI shows Empty state)', () => {
    expect(resolveLocale({ ar: '', en: '' }, 'ar')).toBe('');
    expect(resolveLocale({ ar: '   ', en: '' }, 'en')).toBe('');
  });

  it('honors a custom fallback chain', () => {
    expect(
      resolveLocale({ ar: '', en: 'Hello' }, 'ar', ['ar']),
    ).toBe(''); // chain only includes ar, so no fallback to en
    expect(
      resolveLocale({ ar: 'مرحبا', en: '' }, 'en', ['en', 'ar']),
    ).toBe('مرحبا');
  });

  it('does not mutate the input object', () => {
    const value = { ar: 'مرحبا', en: 'Hello' };
    const snapshot = JSON.stringify(value);
    resolveLocale(value, 'ar');
    expect(JSON.stringify(value)).toBe(snapshot);
  });
});

describe('Translatable shape — at-least-one-non-empty (FR-I18N-002 / R4)', () => {
  // The validator that enforces the shape lives on the backend. We exercise
  // the equivalent rule here at the resolver level: a fully-empty translatable
  // resolves to '' so callers can detect "missing translation".
  it('detects all-empty as a missing translation', () => {
    expect(resolveLocale({ ar: '', en: '' }, 'ar')).toBe('');
  });

  it('passes when at least one locale is non-empty', () => {
    expect(resolveLocale({ ar: 'فقط بالعربية', en: '' }, 'en')).toBe(
      'فقط بالعربية',
    );
    expect(resolveLocale({ ar: '', en: 'English only' }, 'ar')).toBe(
      'English only',
    );
  });
});
