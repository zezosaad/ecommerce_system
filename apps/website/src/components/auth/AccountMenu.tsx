'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/auth/supabase-browser';
import { getApiClient } from '@/lib/api/api-client';
import type { AuthEnvelopeDto } from '@vendorhub/types';

export function AccountMenu({
  envelope,
  locale,
}: {
  envelope: AuthEnvelopeDto;
  locale: string;
}) {
  const t = useTranslations('auth.customer.account');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setOpen(false);
    try {
      const client = getApiClient();
      await client.post('/api/v1/auth/logout').catch(() => {});
    } catch {}

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  const displayName =
    envelope.user.firstName && envelope.user.lastName
      ? `${envelope.user.firstName} ${envelope.user.lastName}`
      : envelope.user.email;

  const initials = (
    envelope.user.firstName?.[0] ?? envelope.user.email[0] ?? '?'
  ).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">
          {initials}
        </span>
        <span className="text-gray-700 hidden sm:inline">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {envelope.user.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}
