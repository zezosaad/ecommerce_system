'use client';

import { useTranslations } from 'next-intl';

export default function DashboardHomePage(): React.JSX.Element {
  const t = useTranslations('common');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600">{t('welcome')}</p>
    </div>
  );
}
