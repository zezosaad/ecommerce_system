import type { AuthEnvelopeDto } from '@vendorhub/types';

export interface NavItem {
  href: string;
  labelKey: string;
  requirePermissions?: string[];
  requireRoles?: string[];
  children?: NavItem[];
  disabled?: boolean;
  disabledTooltipKey?: string;
}

export const NAV_CONFIG: NavItem[] = [
  { href: '/', labelKey: 'auth.sidebar.dashboard' },
  {
    href: '/admin',
    labelKey: 'auth.sidebar.admin',
    requirePermissions: ['users.manage.view'],
    children: [
      {
        href: '/roles',
        labelKey: 'auth.sidebar.roles',
        requirePermissions: ['roles.manage.view'],
      },
      {
        href: '/users',
        labelKey: 'auth.sidebar.users',
        requirePermissions: ['users.manage.view'],
      },
      {
        href: '/permissions',
        labelKey: 'auth.sidebar.permissions',
        requirePermissions: ['permissions.manage.view'],
      },
    ],
  },
  {
    href: '/merchants',
    labelKey: 'auth.sidebar.merchants',
    requirePermissions: ['merchants.manage.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/stores',
    labelKey: 'auth.sidebar.stores',
    requirePermissions: ['stores.manage.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/products',
    labelKey: 'auth.sidebar.products',
    requirePermissions: ['products.manage.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/orders',
    labelKey: 'auth.sidebar.orders',
    requirePermissions: ['orders.manage.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/support',
    labelKey: 'auth.sidebar.support',
    requireRoles: ['support_agent'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/finance',
    labelKey: 'auth.sidebar.finance',
    requirePermissions: ['reports.finance.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
  {
    href: '/audit-logs',
    labelKey: 'auth.sidebar.auditLogs',
    requirePermissions: ['audit_logs.entries.view'],
    disabled: true,
    disabledTooltipKey: 'auth.sidebar.comingSoon',
  },
];

export function filterNavByEnvelope(
  items: NavItem[],
  envelope: AuthEnvelopeDto,
): NavItem[] {
  return items
    .filter((item) => {
      if (envelope.isSuperAdmin) return true;

      if (item.requirePermissions?.length) {
        const hasAll = item.requirePermissions.every((p) =>
          envelope.permissions.includes(p),
        );
        if (!hasAll) return false;
      }

      if (item.requireRoles?.length) {
        const hasRole = item.requireRoles.some((r) =>
          envelope.roles.some((role) => role.key === r),
        );
        if (!hasRole) return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavByEnvelope(item.children, envelope)
        : undefined,
    }));
}
