import { describe, it, expect } from 'vitest';
import { TenantAwareRepository } from '../../src/modules/common/tenant/tenant-aware.repository';

describe('TenantAwareRepository', () => {
  it('throws when merchant scope is required but missing', () => {
    const repo = new TenantAwareRepository();
    expect(() =>
      repo.ensureTenantScope(
        { merchantId: null, storeId: null, isSuperAdmin: false },
        true,
        false,
      ),
    ).toThrow('Merchant scope is required for this operation.');
  });
});
