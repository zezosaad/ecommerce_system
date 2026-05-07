import { cache } from 'react';
import { getApiClient } from '../api-client';
import { createClient } from './supabase-server';
import type { AuthEnvelopeDto } from '@vendorhub/types';

export type AuthEnvelopeResult =
  | { kind: 'ok'; envelope: AuthEnvelopeDto }
  | { kind: 'unauthenticated' }
  | { kind: 'blocked' }
  | { kind: 'error' };

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Resolves the caller's identity envelope from the backend, distinguishing
 * unauthenticated, blocked (suspended/pending), and infra-error states so
 * the consuming layout can render the right UI (login redirect, suspended
 * page, error boundary) instead of an indefinite loading spinner.
 */
export const resolveAuthEnvelope = cache(
  async (): Promise<AuthEnvelopeResult> => {
    const session = await getSession();
    if (!session?.access_token) return { kind: 'unauthenticated' };

    try {
      const client = getApiClient();
      const res = await client.get<AuthEnvelopeDto>('/api/v1/auth/me');
      return { kind: 'ok', envelope: res.data };
    } catch (error) {
      const status = (error as { status?: number; response?: { status?: number } })
        ?.status ??
        (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) return { kind: 'unauthenticated' };
      if (status === 403) return { kind: 'blocked' };
      return { kind: 'error' };
    }
  },
);

/** Backwards-compatible thin wrapper; prefer resolveAuthEnvelope. */
export const getAuthEnvelope = cache(async (): Promise<AuthEnvelopeDto | null> => {
  const result = await resolveAuthEnvelope();
  return result.kind === 'ok' ? result.envelope : null;
});

export function hasNonCustomerRole(envelope: AuthEnvelopeDto): boolean {
  if (envelope.isSuperAdmin) return true;
  return envelope.roles.some((r) => r.key !== 'customer');
}

export function requirePermission(
  envelope: AuthEnvelopeDto,
  key: string,
): boolean {
  if (envelope.isSuperAdmin) return true;
  return envelope.permissions.includes(key);
}
