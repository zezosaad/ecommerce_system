'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/auth/supabase-browser';
import { safeReturnPath } from '@/lib/auth/safe-redirect';

export default function LoginPage(): React.JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'en';
  const returnTo = safeReturnPath(searchParams.get('return'), `/${locale}`);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(t('login.error.invalidCredentials'));
        return;
      }

      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;

      if (token) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
        await fetch(`${apiUrl}/api/v1/auth/sync-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email }),
        }).catch(() => {});
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setError(t('login.error.unexpected'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm border border-gray-200 rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-1">{t('login.title')}</h1>
        <p className="text-sm text-gray-600 mb-6">{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('login.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('login.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? t('login.signingIn') : t('login.submit')}
          </button>
        </form>
      </div>
    </main>
  );
}
