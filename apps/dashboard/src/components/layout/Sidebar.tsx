'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '../shell/LocaleSwitcher';

interface NavItemData {
  href: string;
  labelKey: string;
  children?: NavItemData[];
  disabled?: boolean;
  disabledTooltipKey?: string;
}

export function Sidebar({
  navItems,
  locale,
}: {
  navItems: NavItemData[];
  locale: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const normalized = href.startsWith('/') ? href : `/${href}`;
    return pathname === `/${locale}${normalized}` || pathname === normalized;
  }

  return (
    <aside className="w-60 border-r border-gray-200 p-4 flex flex-col gap-1">
      <Link
        href={`/${locale}`}
        className="font-semibold text-lg mb-4 text-gray-900 hover:text-blue-600"
      >
        VendorHub
      </Link>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <div key={item.href}>
            <Link
              href={item.disabled ? '#' : `/${locale}${item.href}`}
              title={
                item.disabled && item.disabledTooltipKey
                  ? t(item.disabledTooltipKey)
                  : undefined
              }
              className={`block px-3 py-2 text-sm rounded-md ${
                item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : isActive(item.href)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
              aria-disabled={item.disabled}
              onClick={(e) => {
                if (item.disabled) e.preventDefault();
              }}
            >
              {t(item.labelKey)}
            </Link>
            {item.children && (
              <div className="ml-3 mt-1 space-y-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={
                      child.disabled
                        ? '#'
                        : `/${locale}${child.href}`
                    }
                    title={
                      child.disabled && child.disabledTooltipKey
                        ? t(child.disabledTooltipKey)
                        : undefined
                    }
                    className={`block px-3 py-1.5 text-sm rounded-md ${
                      child.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : isActive(child.href)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    aria-disabled={child.disabled}
                    onClick={(e) => {
                      if (child.disabled) e.preventDefault();
                    }}
                  >
                    {t(child.labelKey)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="pt-4 border-t border-gray-200">
        <LocaleSwitcher />
      </div>
    </aside>
  );
}
