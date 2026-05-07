import { createClient } from '@/lib/auth/supabase-server';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';
import { Loading } from '@/components/states/Loading';

interface AccountLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function AccountLayout({
  children,
  params: { locale },
}: AccountLayoutProps): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading message={locale === 'ar' ? 'جاري التحميل...' : 'Loading...'} />
      </div>
    );
  }

  let envelopeData = null;
  try {
    const token = session.access_token;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/v1/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const json = await res.json();
      envelopeData = json.data;
    }
  } catch {
    // envelope data is optional for layout
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b border-gray-200 px-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">
          VendorHub
        </span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {envelopeData && <AccountMenu envelope={envelopeData} locale={locale} />}
        </div>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
