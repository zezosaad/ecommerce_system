import { describe, it, expect } from 'vitest';
import {
  TenantAwareRepository,
  type TenantContext,
} from '../../src/modules/common/tenant/tenant-aware.repository';

const ctx = (overrides: Partial<TenantContext>): TenantContext => ({
  merchantId: null,
  storeId: null,
  isSuperAdmin: false,
  ...overrides,
});

describe('TenantAwareRepository — ensureTenantScope (FR-TEN-003)', () => {
  it('refuses tenant-scoped operation when context is undefined', () => {
    const repo = new TenantAwareRepository();
    expect(() => repo.ensureTenantScope(undefined, true, false)).toThrow(
      /TenantContext is required/,
    );
  });

  it('refuses when merchant is required but context.merchantId is null', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(ctx({}), true, false),
    ).toThrow(/Merchant scope is required/);
  });

  it('refuses when store is required but context.storeId is null', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(
        ctx({ merchantId: 'm-1' }),
        true,
        true,
      ),
    ).toThrow(/Store scope is required/);
  });

  it('allows when merchant scope is present and required', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(ctx({ merchantId: 'm-1' }), true, false),
    ).not.toThrow();
  });

  it('allows when both scopes are present and required', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(
        ctx({ merchantId: 'm-1', storeId: 's-1' }),
        true,
        true,
      ),
    ).not.toThrow();
  });

  it('Super Admin bypasses all scope checks (FR-TEN-004)', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(ctx({ isSuperAdmin: true }), true, true),
    ).not.toThrow();
  });
});

describe('TenantAwareRepository — buildTenantWhere', () => {
  it('returns an empty filter when context is undefined (Super Admin path)', () => {
    const repo = new TenantAwareRepository();
    expect(repo.buildTenantWhere(undefined)).toEqual({});
  });

  it('returns an empty filter for Super Admin (cross-tenant override)', () => {
    const repo = new TenantAwareRepository();
    expect(
      repo.buildTenantWhere(ctx({ isSuperAdmin: true, merchantId: 'm-1' }), {
        merchantField: 'merchantId',
      }),
    ).toEqual({});
  });

  it('scopes by merchantId when merchantField is given and context has merchantId', () => {
    const repo = new TenantAwareRepository();
    expect(
      repo.buildTenantWhere(ctx({ merchantId: 'merchant-A' }), {
        merchantField: 'merchantId',
      }),
    ).toEqual({ merchantId: 'merchant-A' });
  });

  it('scopes by both merchant and store when both fields and values present', () => {
    const repo = new TenantAwareRepository();
    expect(
      repo.buildTenantWhere(
        ctx({ merchantId: 'merchant-A', storeId: 'store-1' }),
        { merchantField: 'merchantId', storeField: 'storeId' },
      ),
    ).toEqual({ merchantId: 'merchant-A', storeId: 'store-1' });
  });

  it('cross-merchant: merchant A cannot construct a where clause naming merchant B', () => {
    // The repo helper only ever returns where clauses scoped to the
    // caller's own merchantId. There is no parameter through which a
    // non-Super-Admin caller can ask for a different merchant.
    const repo = new TenantAwareRepository();
    const where = repo.buildTenantWhere(ctx({ merchantId: 'A' }), {
      merchantField: 'merchantId',
    });
    expect(where.merchantId).toBe('A');
    // Trying to override would require a different code path that doesn't
    // exist on the public API:
    expect(Object.keys(where)).toEqual(['merchantId']);
  });
});
