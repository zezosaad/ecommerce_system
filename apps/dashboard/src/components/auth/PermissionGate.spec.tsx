import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from './PermissionGate';

vi.mock('next-intl', () => ({
  useTranslations: () => (_key: string) => '',
}));

describe('PermissionGate', () => {
  it('renders children when permission is present', () => {
    render(
      <PermissionGate require="roles.manage.view" permissions={['roles.manage.view']}>
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.getByTestId('content')).toBeDefined();
  });

  it('hides children when permission is absent', () => {
    render(
      <PermissionGate require="roles.manage.view" permissions={[]}>
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('renders fallback when permission is absent and fallback is provided', () => {
    render(
      <PermissionGate
        require="roles.manage.view"
        permissions={[]}
        fallback={<div data-testid="fallback">Access Denied</div>}
      >
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeDefined();
  });

  it('allows access when isSuperAdmin is true regardless of permissions', () => {
    render(
      <PermissionGate
        require="roles.manage.view"
        permissions={[]}
        isSuperAdmin={true}
      >
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.getByTestId('content')).toBeDefined();
  });

  it('requires all permissions when given an array', () => {
    render(
      <PermissionGate
        require={['users.manage.view', 'users.manage.update']}
        permissions={['users.manage.view']}
      >
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('passes when all array permissions are present', () => {
    render(
      <PermissionGate
        require={['users.manage.view', 'users.manage.update']}
        permissions={['users.manage.view', 'users.manage.update']}
      >
        <div data-testid="content">Content</div>
      </PermissionGate>,
    );
    expect(screen.getByTestId('content')).toBeDefined();
  });
});
