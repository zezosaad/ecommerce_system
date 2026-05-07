'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/auth/supabase-browser';
import { Loading } from '@/components/states/Loading';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const pathname = usePathname();
  const locale = params?.locale ?? 'en';
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function evaluate(session: { access_token?: string } | null) {
      if (cancelled) return;
      if (session?.access_token) {
        setAuthenticated(true);
        setChecking(false);
      } else {
        setAuthenticated(false);
        setChecking(false);
        // Redirect, preserving the page the user wanted to reach.
        const returnTo = encodeURIComponent(pathname ?? `/${locale}`);
        router.replace(`/${locale}/login?return=${returnTo}`);
      }
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));

    // React to sign-out / token-refresh events so the guard re-evaluates
    // when another tab logs out.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        evaluate(session);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [router, locale, pathname]);

  if (checking) {
    return fallback ?? <Loading />;
  }

  if (!authenticated) {
    // Router redirect is in flight — render nothing rather than children.
    return fallback ?? <Loading />;
  }

  return <>{children}</>;
}
