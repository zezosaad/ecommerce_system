export interface TenantContext {
  merchantId: string | null;
  storeId: string | null;
  isSuperAdmin: boolean;
}

export class TenantAwareRepository {
  ensureTenantScope(
    context: TenantContext | undefined,
    tableRequiresMerchant: boolean,
    tableRequiresStore: boolean,
  ): void {
    if (!context) {
      throw new Error(
        'TenantContext is required for tenant-scoped queries.',
      );
    }

    if (context.isSuperAdmin) return;

    if (tableRequiresMerchant && !context.merchantId) {
      throw new Error(
        'Merchant scope is required for this operation.',
      );
    }

    if (tableRequiresStore && !context.storeId) {
      throw new Error(
        'Store scope is required for this operation.',
      );
    }
  }

  buildTenantWhere(
    context: TenantContext | undefined,
    options?: { merchantField?: string; storeField?: string },
  ): Record<string, unknown> {
    if (!context || context.isSuperAdmin) {
      return {};
    }

    const where: Record<string, unknown> = {};
    if (options?.merchantField && context.merchantId) {
      where[options.merchantField] = context.merchantId;
    }
    if (options?.storeField && context.storeId) {
      where[options.storeField] = context.storeId;
    }
    return where;
  }
}
