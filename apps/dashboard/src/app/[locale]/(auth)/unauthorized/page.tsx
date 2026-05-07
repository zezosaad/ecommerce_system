'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function UnauthorizedPage(): React.JSX.Element {
  const t = useTranslations('auth');

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 115.636 5.636m12.728 12.728A9 9 0 015.636 5.636"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {t('unauthorized.title')}
        </h1>
        <p className="text-gray-600 mb-6">{t('unauthorized.message')}</p>
        <Link
          href="/login"
          className="inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {t('login.title')}
        </Link>
      </div>
    </main>
  );
}
