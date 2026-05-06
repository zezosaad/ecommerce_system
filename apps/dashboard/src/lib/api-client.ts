/**
 * Dashboard-side singleton ApiClient. Pulls the access token from the
 * existing Supabase auth helper and registers the dashboard's
 * session-expired flow. Re-exports the shared error type for consumers.
 */

import {
  ApiClient,
  ApiClientError,
  registerSessionExpiredCallback,
} from '@vendorhub/api-client';
import { getAccessToken } from './auth';

let client: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (client) return client;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  client = new ApiClient({
    baseUrl,
    getAccessToken,
  });

  return client;
}

export { ApiClientError, registerSessionExpiredCallback };
export type { SuccessEnvelope, ListEnvelope, ErrorEnvelope } from '@vendorhub/types';
