import {
  ApiClient,
  ApiClientError,
  registerSessionExpiredCallback,
} from '@vendorhub/api-client';

let client: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (client) return client;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  client = new ApiClient({
    baseUrl,
    getAccessToken: async () => {
      const supabase = (await import('@supabase/ssr')).createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });

  return client;
}

export { ApiClientError, registerSessionExpiredCallback };
export type { SuccessEnvelope, ListEnvelope, ErrorEnvelope } from '@vendorhub/types';
