'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/auth/supabase-browser';
import { getApiClient } from '@/lib/api/api-client';

export default function VerifyEmailPage(): React.JSX.Element {
  const t = useTranslations('auth.customer.verifyEmail');
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'verified' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkVerification() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setStatus('error');
          setMessage(t('error'));
          return;
        }

        const client = getApiClient();
        const res = (await client
          .get('/api/v1/auth/me')
          .catch(() => null)) as { data?: { user?: { status?: string } } } | null;

        if (res?.data?.user?.status === 'active') {
          setStatus('verified');
          setMessage(t('verified'));
          setTimeout(() => router.push('/account'), 1500);
        } else {
          const result = await supabase.auth.getUser();
          if (result.data?.user?.email_confirmed_at) {
            // Status is NOT a self-editable field — the backend derives it
            // from Supabase's email_confirmed_at via FR-005a/FR-005b. Posting
            // an empty body simply triggers the sync + lazy reconciliation.
            const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
            await fetch(`${apiUrl}/api/v1/auth/sync-profile`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({}),
            }).catch(() => {});
            setStatus('verified');
            setMessage(t('verified'));
            setTimeout(() => router.push('/account'), 1500);
          } else {
            setStatus('error');
            setMessage(t('error'));
          }
        }
      } catch {
        setStatus('error');
        setMessage(t('error'));
      }
    }

    checkVerification();
  }, [router, t]);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        {status === 'checking' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600">{t('checking')}</p>
          </>
        )}

        {status === 'verified' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {t('resend')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
