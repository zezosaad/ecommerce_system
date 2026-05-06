'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function createAuthClient() {
  return createClientComponentClient();
}

export async function getSession() {
  const supabase = createClientComponentClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClientComponentClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClientComponentClient();
  return supabase.auth.signOut();
}
