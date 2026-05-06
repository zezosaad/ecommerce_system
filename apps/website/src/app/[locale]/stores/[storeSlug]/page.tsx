'use client';

import { useTranslations } from 'next-intl';
import { Empty } from '../../../../components/states/Empty';

export default function StorePage({
  params,
}: {
  params: { storeSlug: string };
}): React.JSX.Element {
  const t = useTranslations('common');

  return (
    <main className="min-h-screen p-8">
      <Empty
        title={t('storeNotFound')}
        description={`Store "${params.storeSlug}" has not been set up yet.`}
      />
    </main>
  );
}
