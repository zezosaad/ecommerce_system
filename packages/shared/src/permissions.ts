export interface ParsedPermissionKey {
  module: string;
  resource: string;
  action: string;
}

const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+$/;

export function parsePermissionKey(key: string): ParsedPermissionKey {
  if (!PERMISSION_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid permission key format: "${key}". Expected format: module.resource.action`);
  }
  const [module, resource, action] = key.split('.');
  return { module, resource, action };
}

export function isValidPermissionKey(key: string): boolean {
  return PERMISSION_KEY_PATTERN.test(key);
}

export function buildPermissionKey(module: string, resource: string, action: string): string {
  return `${module}.${resource}.${action}`;
}

export const SYSTEM_PERMISSIONS: string[] = [
  'users.profile.view',
  'users.profile.update',
  'users.manage.view',
  'users.manage.create',
  'users.manage.update',
  'users.manage.suspend',
  'users.manage.delete',
  'roles.manage.view',
  'roles.manage.create',
  'roles.manage.update',
  'roles.manage.delete',
  'permissions.manage.view',
  'merchants.manage.view',
  'merchants.manage.create',
  'merchants.manage.update',
  'merchants.manage.approve',
  'merchants.manage.suspend',
  'merchants.manage.delete',
  'stores.manage.view',
  'stores.manage.create',
  'stores.manage.update',
  'stores.manage.suspend',
  'stores.manage.delete',
  'products.manage.view',
  'products.manage.create',
  'products.manage.update',
  'products.manage.delete',
  'products.manage.publish',
  'inventory.manage.view',
  'inventory.manage.update',
  'inventory.manage.adjust',
  'inventory.manage.transfer',
  'orders.manage.view',
  'orders.manage.update',
  'orders.manage.cancel',
  'orders.shipping.view',
  'payments.manage.view',
  'payments.manage.refund',
  'payouts.manage.view',
  'payouts.manage.approve',
  'payouts.manage.reject',
  'shipping.manage.view',
  'shipping.manage.create',
  'shipping.manage.update',
  'shipping.manage.delete',
  'coupons.manage.view',
  'coupons.manage.create',
  'coupons.manage.update',
  'coupons.manage.delete',
  'promotions.manage.view',
  'promotions.manage.create',
  'promotions.manage.update',
  'promotions.manage.delete',
  'notifications.manage.view',
  'notifications.manage.send',
  'notifications.manage.template_update',
  'reports.finance.view',
  'reports.sales.view',
  'reports.operations.view',
  'settings.manage.view',
  'settings.manage.update',
  'audit_logs.entries.view',
];
