'use client';

import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '../../components/shell/LocaleSwitcher';

export default function HomePage(): React.JSX.Element {
  const t = useTranslations('common');

  return (
    <main className="min-h-screen p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">VendorHub</h1>
        <LocaleSwitcher />
      </header>
      <p className="text-gray-600">{t('welcome')}</p>
    </main>
  );
}
