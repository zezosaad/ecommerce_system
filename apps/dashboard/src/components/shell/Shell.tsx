'use client';

import React from 'react';
import { LocaleSwitcher } from './LocaleSwitcher';

type NavItem = { href: string; label: string; permission?: string };

const navByRole: Record<string, NavItem[]> = {
  finance_admin: [{ href: '/finance/sample', label: 'Finance Sample', permission: 'platform.settings.read' }],
  merchant_owner: [{ href: '/merchant', label: 'Merchant' }],
  platform_admin: [{ href: '/admin', label: 'Admin' }],
  support_agent: [{ href: '/support', label: 'Support' }],
};

export function Shell({
  roleCodes,
  children,
}: {
  roleCodes: string[];
  children: React.ReactNode;
}) {
  const links = roleCodes.flatMap((role) => navByRole[role] ?? []);

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-gray-200 p-4">
        <h2 className="font-semibold mb-4">VendorHub</h2>
        <nav className="space-y-2">
          {links.map((link) => (
            <a key={`${link.href}-${link.label}`} href={link.href} className="block text-sm text-gray-700 hover:text-black">
              {link.label}
            </a>
          ))}
        </nav>
      </aside>
      <div>
        <header className="h-14 border-b border-gray-200 px-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Dashboard</span>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <button className="text-sm px-3 py-1 rounded bg-gray-100">Account</button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
