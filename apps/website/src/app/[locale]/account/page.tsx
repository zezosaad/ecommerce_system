'use client';

import { useTranslations } from 'next-intl';

export default function AccountHomePage(): React.JSX.Element {
  const t = useTranslations('auth.customer.account');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="#"
          className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-colors"
        >
          <h2 className="font-semibold text-gray-900">{t('orders')}</h2>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </a>
        <a
          href="#"
          className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-colors"
        >
          <h2 className="font-semibold text-gray-900">{t('addresses')}</h2>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </a>
        <a
          href="#"
          className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-colors"
        >
          <h2 className="font-semibold text-gray-900">{t('wishlist')}</h2>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </a>
        <a
          href="#"
          className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-colors"
        >
          <h2 className="font-semibold text-gray-900">{t('settings')}</h2>
          <p className="text-sm text-gray-500 mt-1">Coming soon</p>
        </a>
      </div>
    </div>
  );
}
