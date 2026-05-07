import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/roles',
}));

vi.mock('../shell/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

describe('Sidebar', () => {
  const defaultNavItems = [
    { href: '/', labelKey: 'auth.sidebar.dashboard' },
    {
      href: '/admin',
      labelKey: 'auth.sidebar.admin',
      children: [
        { href: '/roles', labelKey: 'auth.sidebar.roles' },
        { href: '/users', labelKey: 'auth.sidebar.users' },
      ],
    },
  ];

  it('renders all nav items', () => {
    render(<Sidebar navItems={defaultNavItems} locale="en" />);
    expect(screen.getByText('auth.sidebar.dashboard')).toBeDefined();
    expect(screen.getByText('auth.sidebar.admin')).toBeDefined();
    expect(screen.getByText('auth.sidebar.roles')).toBeDefined();
    expect(screen.getByText('auth.sidebar.users')).toBeDefined();
  });

  it('highlights active item', () => {
    render(<Sidebar navItems={defaultNavItems} locale="en" />);
    const rolesLink = screen.getByText('auth.sidebar.roles');
    expect(rolesLink.className).toContain('bg-blue-50');
  });

  it('renders only allowed items when filtered', () => {
    const filteredNavItems = [
      { href: '/', labelKey: 'auth.sidebar.dashboard' },
    ];
    render(<Sidebar navItems={filteredNavItems} locale="en" />);
    expect(screen.getByText('auth.sidebar.dashboard')).toBeDefined();
    expect(screen.queryByText('auth.sidebar.admin')).toBeNull();
  });

  it('disables items with disabled flag', () => {
    const items = [
      {
        href: '/merchants',
        labelKey: 'auth.sidebar.merchants',
        disabled: true,
        disabledTooltipKey: 'auth.sidebar.comingSoon',
      },
    ];
    render(<Sidebar navItems={items} locale="en" />);
    const link = screen.getByText('auth.sidebar.merchants');
    expect(link.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders locale switcher', () => {
    render(<Sidebar navItems={defaultNavItems} locale="en" />);
    expect(screen.getByTestId('locale-switcher')).toBeDefined();
  });
});
