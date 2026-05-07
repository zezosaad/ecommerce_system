import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { resolveAuthEnvelope } from '../../../lib/auth/session';
import { filterNavByEnvelope } from '../../../lib/nav';
import { Sidebar } from '../../../components/layout/Sidebar';
import { UserMenu } from '../../../components/auth/UserMenu';
import { Loading } from '../../../components/states/Loading';

export default async function ProtectedLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}): Promise<React.JSX.Element> {
  const result = await resolveAuthEnvelope();

  if (result.kind === 'unauthenticated') {
    redirect(`/${locale}/login`);
  }
  if (result.kind === 'blocked') {
    redirect(`/${locale}/suspended`);
  }
  if (result.kind === 'error') {
    // Network/backend failure — render an explicit error rather than a
    // forever-loading spinner.
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Service unavailable
          </h1>
          <p className="text-sm text-gray-600">
            Could not contact the platform. Please retry in a moment.
          </p>
        </div>
      </div>
    );
  }
  const envelope = result.envelope;

  const navItems = filterNavByEnvelope(
    [
      { href: '/', labelKey: 'auth.sidebar.dashboard' },
      ...(envelope.isSuperAdmin ||
      envelope.roles.some((r) => r.key !== 'customer')
        ? [
            {
              href: '/admin',
              labelKey: 'auth.sidebar.admin',
              children: [
                ...(envelope.permissions.includes('roles.manage.view')
                  ? [
                      {
                        href: `/${locale}/roles`,
                        labelKey: 'auth.sidebar.roles',
                      },
                    ]
                  : []),
                ...(envelope.permissions.includes('users.manage.view')
                  ? [
                      {
                        href: `/${locale}/users`,
                        labelKey: 'auth.sidebar.users',
                      },
                    ]
                  : []),
              ].filter(Boolean),
            },
          ]
        : []),
    ],
    envelope,
  );

  return (
    <div className="min-h-screen flex">
      <Sidebar navItems={navItems} locale={locale} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-gray-200 px-4 flex items-center justify-end gap-3">
          <UserMenu envelope={envelope} locale={locale} />
        </header>
        <main className="flex-1 p-6">
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
