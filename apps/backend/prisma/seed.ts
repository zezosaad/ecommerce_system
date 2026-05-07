import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { code: 'super_admin', label: { ar: 'المسؤول الأعلى', en: 'Super Admin' }, description: { ar: 'وصول كامل إلى جميع وظائف النظام', en: 'Full access to all system functions' }, isSystem: true },
  { code: 'platform_admin', label: { ar: 'مسؤول المنصة', en: 'Platform Admin' }, description: { ar: 'إدارة المنصة والإعدادات', en: 'Platform management and settings' }, isSystem: true },
  { code: 'merchant', label: { ar: 'تاجر', en: 'Merchant' }, description: { ar: 'إدارة كاملة للتاجر', en: 'Full merchant management' }, isSystem: true },
  { code: 'merchant_staff', label: { ar: 'موظف التاجر', en: 'Merchant Staff' }, description: { ar: 'وصول محدود لإدارة التاجر', en: 'Limited merchant management access' }, isSystem: true },
  { code: 'customer', label: { ar: 'عميل', en: 'Customer' }, description: { ar: 'تصفح وشراء المنتجات', en: 'Browse and purchase products' }, isSystem: true },
  { code: 'support_agent', label: { ar: 'وكيل الدعم', en: 'Support Agent' }, description: { ar: 'تقديم الدعم للعملاء', en: 'Customer support' }, isSystem: true },
  { code: 'finance_admin', label: { ar: 'مسؤول المالية', en: 'Finance Admin' }, description: { ar: 'إدارة الشؤون المالية', en: 'Financial management' }, isSystem: true },
  { code: 'shipping_agent', label: { ar: 'وكيل الشحن', en: 'Shipping Agent' }, description: { ar: 'إدارة الشحن والت التوصيل', en: 'Shipping and delivery management' }, isSystem: true },
];

const SYSTEM_PERMISSIONS = [
  { code: 'users.profile.view', module: 'users', resource: 'profile', action: 'view', label: { ar: 'عرض الملف الشخصي', en: 'View profile' }, description: { ar: 'عرض ملف الشخصي للمستخدم', en: 'View own user profile' } },
  { code: 'users.profile.update', module: 'users', resource: 'profile', action: 'update', label: { ar: 'تحديث الملف الشخصي', en: 'Update profile' }, description: { ar: 'تحديث ملف الشخصي', en: 'Update own user profile' } },
  { code: 'users.manage.view', module: 'users', resource: 'manage', action: 'view', label: { ar: 'عرض المستخدمين', en: 'View users' }, description: { ar: 'عرض بيانات المستخدمين', en: 'View user data' } },
  { code: 'users.manage.create', module: 'users', resource: 'manage', action: 'create', label: { ar: 'إنشاء مستخدم', en: 'Create user' }, description: { ar: 'إنشاء مستخدم جديد', en: 'Create a new user' } },
  { code: 'users.manage.update', module: 'users', resource: 'manage', action: 'update', label: { ar: 'تحديث مستخدم', en: 'Update user' }, description: { ar: 'تحديث بيانات المستخدم', en: 'Update user data' } },
  { code: 'users.manage.suspend', module: 'users', resource: 'manage', action: 'suspend', label: { ar: 'تعليق مستخدم', en: 'Suspend user' }, description: { ar: 'تعليق حساب المستخدم', en: 'Suspend user account' } },
  { code: 'users.manage.delete', module: 'users', resource: 'manage', action: 'delete', label: { ar: 'حذف مستخدم', en: 'Delete user' }, description: { ar: 'حذف المستخدم', en: 'Delete user' } },
  { code: 'roles.manage.view', module: 'roles', resource: 'manage', action: 'view', label: { ar: 'عرض الأدوار', en: 'View roles' }, description: { ar: 'عرض الأدوار', en: 'View roles' } },
  { code: 'roles.manage.create', module: 'roles', resource: 'manage', action: 'create', label: { ar: 'إنشاء دور', en: 'Create role' }, description: { ar: 'إنشاء دور جديد', en: 'Create a new role' } },
  { code: 'roles.manage.update', module: 'roles', resource: 'manage', action: 'update', label: { ar: 'تحديث دور', en: 'Update role' }, description: { ar: 'تحديث دور', en: 'Update role' } },
  { code: 'roles.manage.delete', module: 'roles', resource: 'manage', action: 'delete', label: { ar: 'حذف دور', en: 'Delete role' }, description: { ar: 'حذف دور', en: 'Delete role' } },
  { code: 'permissions.manage.view', module: 'permissions', resource: 'manage', action: 'view', label: { ar: 'عرض الصلاحيات', en: 'View permissions' }, description: { ar: 'عرض الصلاحيات', en: 'View permissions' } },
  { code: 'merchants.manage.view', module: 'merchants', resource: 'manage', action: 'view', label: { ar: 'عرض التجار', en: 'View merchants' }, description: { ar: 'عرض بيانات التجار', en: 'View merchant data' } },
  { code: 'merchants.manage.create', module: 'merchants', resource: 'manage', action: 'create', label: { ar: 'إنشاء تاجر', en: 'Create merchant' }, description: { ar: 'إنشاء تاجر جديد', en: 'Create a new merchant' } },
  { code: 'merchants.manage.update', module: 'merchants', resource: 'manage', action: 'update', label: { ar: 'تحديث تاجر', en: 'Update merchant' }, description: { ar: 'تحديث بيانات التاجر', en: 'Update merchant data' } },
  { code: 'merchants.manage.approve', module: 'merchants', resource: 'manage', action: 'approve', label: { ar: 'موافقة تاجر', en: 'Approve merchant' }, description: { ar: 'الموافقة على تاجر', en: 'Approve a merchant' } },
  { code: 'merchants.manage.suspend', module: 'merchants', resource: 'manage', action: 'suspend', label: { ar: 'تعليق تاجر', en: 'Suspend merchant' }, description: { ar: 'تعليق تاجر', en: 'Suspend merchant' } },
  { code: 'merchants.manage.delete', module: 'merchants', resource: 'manage', action: 'delete', label: { ar: 'حذف تاجر', en: 'Delete merchant' }, description: { ar: 'حذف تاجر', en: 'Delete merchant' } },
  { code: 'stores.manage.view', module: 'stores', resource: 'manage', action: 'view', label: { ar: 'عرض المتاجر', en: 'View stores' }, description: { ar: 'عرض بيانات المتاجر', en: 'View store data' } },
  { code: 'stores.manage.create', module: 'stores', resource: 'manage', action: 'create', label: { ar: 'إنشاء متجر', en: 'Create store' }, description: { ar: 'إنشاء متجر جديد', en: 'Create a new store' } },
  { code: 'stores.manage.update', module: 'stores', resource: 'manage', action: 'update', label: { ar: 'تحديث متجر', en: 'Update store' }, description: { ar: 'تحديث بيانات المتجر', en: 'Update store data' } },
  { code: 'stores.manage.suspend', module: 'stores', resource: 'manage', action: 'suspend', label: { ar: 'تعليق متجر', en: 'Suspend store' }, description: { ar: 'تعليق متجر', en: 'Suspend store' } },
  { code: 'stores.manage.delete', module: 'stores', resource: 'manage', action: 'delete', label: { ar: 'حذف متجر', en: 'Delete store' }, description: { ar: 'حذف متجر', en: 'Delete store' } },
  { code: 'products.manage.view', module: 'products', resource: 'manage', action: 'view', label: { ar: 'عرض المنتجات', en: 'View products' }, description: { ar: 'عرض المنتجات', en: 'View products' } },
  { code: 'products.manage.create', module: 'products', resource: 'manage', action: 'create', label: { ar: 'إنشاء منتج', en: 'Create product' }, description: { ar: 'إنشاء منتج جديد', en: 'Create a new product' } },
  { code: 'products.manage.update', module: 'products', resource: 'manage', action: 'update', label: { ar: 'تحديث منتج', en: 'Update product' }, description: { ar: 'تحديث منتج', en: 'Update product' } },
  { code: 'products.manage.delete', module: 'products', resource: 'manage', action: 'delete', label: { ar: 'حذف منتج', en: 'Delete product' }, description: { ar: 'حذف منتج', en: 'Delete product' } },
  { code: 'products.manage.publish', module: 'products', resource: 'manage', action: 'publish', label: { ar: 'نشر منتج', en: 'Publish product' }, description: { ar: 'نشر منتج', en: 'Publish product' } },
  { code: 'inventory.manage.view', module: 'inventory', resource: 'manage', action: 'view', label: { ar: 'عرض المخزون', en: 'View inventory' }, description: { ar: 'عرض المخزون', en: 'View inventory' } },
  { code: 'inventory.manage.update', module: 'inventory', resource: 'manage', action: 'update', label: { ar: 'تحديث المخزون', en: 'Update inventory' }, description: { ar: 'تحديث المخزون', en: 'Update inventory' } },
  { code: 'inventory.manage.adjust', module: 'inventory', resource: 'manage', action: 'adjust', label: { ar: 'تعديل المخزون', en: 'Adjust inventory' }, description: { ar: 'تعديل المخزون', en: 'Adjust inventory' } },
  { code: 'inventory.manage.transfer', module: 'inventory', resource: 'manage', action: 'transfer', label: { ar: 'نقل المخزون', en: 'Transfer inventory' }, description: { ar: 'نقل المخزون', en: 'Transfer inventory' } },
  { code: 'orders.manage.view', module: 'orders', resource: 'manage', action: 'view', label: { ar: 'عرض الطلبات', en: 'View orders' }, description: { ar: 'عرض الطلبات', en: 'View orders' } },
  { code: 'orders.manage.update', module: 'orders', resource: 'manage', action: 'update', label: { ar: 'تحديث طلب', en: 'Update order' }, description: { ar: 'تحديث طلب', en: 'Update order' } },
  { code: 'orders.manage.cancel', module: 'orders', resource: 'manage', action: 'cancel', label: { ar: 'إلغاء طلب', en: 'Cancel order' }, description: { ar: 'إلغاء طلب', en: 'Cancel order' } },
  { code: 'orders.shipping.view', module: 'orders', resource: 'shipping', action: 'view', label: { ar: 'عرض شحن الطلبات', en: 'View order shipping' }, description: { ar: 'عرض شحن الطلبات', en: 'View order shipping' } },
  { code: 'payments.manage.view', module: 'payments', resource: 'manage', action: 'view', label: { ar: 'عرض المدفوعات', en: 'View payments' }, description: { ar: 'عرض المدفوعات', en: 'View payments' } },
  { code: 'payments.manage.refund', module: 'payments', resource: 'manage', action: 'refund', label: { ar: 'استرداد مدفوعات', en: 'Refund payment' }, description: { ar: 'استرداد مدفوعات', en: 'Refund payment' } },
  { code: 'payouts.manage.view', module: 'payouts', resource: 'manage', action: 'view', label: { ar: 'عرض المدفوعات', en: 'View payouts' }, description: { ar: 'عرض المدفوعات', en: 'View payouts' } },
  { code: 'payouts.manage.approve', module: 'payouts', resource: 'manage', action: 'approve', label: { ar: 'موافقة على مدفوعات', en: 'Approve payout' }, description: { ar: 'الموافقة على مدفوعات', en: 'Approve payout' } },
  { code: 'payouts.manage.reject', module: 'payouts', resource: 'manage', action: 'reject', label: { ar: 'رفض مدفوعات', en: 'Reject payout' }, description: { ar: 'رفض مدفوعات', en: 'Reject payout' } },
  { code: 'shipping.manage.view', module: 'shipping', resource: 'manage', action: 'view', label: { ar: 'عرض الشحن', en: 'View shipping' }, description: { ar: 'عرض الشحن', en: 'View shipping' } },
  { code: 'shipping.manage.create', module: 'shipping', resource: 'manage', action: 'create', label: { ar: 'إنشاء شحن', en: 'Create shipping' }, description: { ar: 'إنشاء شحن', en: 'Create shipping' } },
  { code: 'shipping.manage.update', module: 'shipping', resource: 'manage', action: 'update', label: { ar: 'تحديث شحن', en: 'Update shipping' }, description: { ar: 'تحديث شحن', en: 'Update shipping' } },
  { code: 'shipping.manage.delete', module: 'shipping', resource: 'manage', action: 'delete', label: { ar: 'حذف شحن', en: 'Delete shipping' }, description: { ar: 'حذف شحن', en: 'Delete shipping' } },
  { code: 'coupons.manage.view', module: 'coupons', resource: 'manage', action: 'view', label: { ar: 'عرض الكوبونات', en: 'View coupons' }, description: { ar: 'عرض الكوبونات', en: 'View coupons' } },
  { code: 'coupons.manage.create', module: 'coupons', resource: 'manage', action: 'create', label: { ar: 'إنشاء كوبون', en: 'Create coupon' }, description: { ar: 'إنشاء كوبون', en: 'Create coupon' } },
  { code: 'coupons.manage.update', module: 'coupons', resource: 'manage', action: 'update', label: { ar: 'تحديث كوبون', en: 'Update coupon' }, description: { ar: 'تحديث كوبون', en: 'Update coupon' } },
  { code: 'coupons.manage.delete', module: 'coupons', resource: 'manage', action: 'delete', label: { ar: 'حذف كوبون', en: 'Delete coupon' }, description: { ar: 'حذف كوبون', en: 'Delete coupon' } },
  { code: 'promotions.manage.view', module: 'promotions', resource: 'manage', action: 'view', label: { ar: 'عرض العروض', en: 'View promotions' }, description: { ar: 'عرض العروض', en: 'View promotions' } },
  { code: 'promotions.manage.create', module: 'promotions', resource: 'manage', action: 'create', label: { ar: 'إنشاء عرض', en: 'Create promotion' }, description: { ar: 'إنشاء عرض', en: 'Create promotion' } },
  { code: 'promotions.manage.update', module: 'promotions', resource: 'manage', action: 'update', label: { ar: 'تحديث عرض', en: 'Update promotion' }, description: { ar: 'تحديث عرض', en: 'Update promotion' } },
  { code: 'promotions.manage.delete', module: 'promotions', resource: 'manage', action: 'delete', label: { ar: 'حذف عرض', en: 'Delete promotion' }, description: { ar: 'حذف عرض', en: 'Delete promotion' } },
  { code: 'notifications.manage.view', module: 'notifications', resource: 'manage', action: 'view', label: { ar: 'عرض الإشعارات', en: 'View notifications' }, description: { ar: 'عرض الإشعارات', en: 'View notifications' } },
  { code: 'notifications.manage.send', module: 'notifications', resource: 'manage', action: 'send', label: { ar: 'إرسال إشعار', en: 'Send notification' }, description: { ar: 'إرسال إشعار', en: 'Send notification' } },
  { code: 'notifications.manage.template_update', module: 'notifications', resource: 'manage', action: 'template_update', label: { ar: 'تحديث قالب الإشعار', en: 'Update notification template' }, description: { ar: 'تحديث قالب الإشعار', en: 'Update notification template' } },
  { code: 'reports.finance.view', module: 'reports', resource: 'finance', action: 'view', label: { ar: 'عرض التقارير المالية', en: 'View finance reports' }, description: { ar: 'عرض التقارير المالية', en: 'View finance reports' } },
  { code: 'reports.sales.view', module: 'reports', resource: 'sales', action: 'view', label: { ar: 'عرض تقارير المبيعات', en: 'View sales reports' }, description: { ar: 'عرض تقارير المبيعات', en: 'View sales reports' } },
  { code: 'reports.operations.view', module: 'reports', resource: 'operations', action: 'view', label: { ar: 'عرض التقارير التشغيلية', en: 'View operations reports' }, description: { ar: 'عرض التقارير التشغيلية', en: 'View operations reports' } },
  { code: 'settings.manage.view', module: 'settings', resource: 'manage', action: 'view', label: { ar: 'عرض الإعدادات', en: 'View settings' }, description: { ar: 'عرض الإعدادات', en: 'View settings' } },
  { code: 'settings.manage.update', module: 'settings', resource: 'manage', action: 'update', label: { ar: 'تحديث الإعدادات', en: 'Update settings' }, description: { ar: 'تحديث الإعدادات', en: 'Update settings' } },
  { code: 'audit_logs.entries.view', module: 'audit_logs', resource: 'entries', action: 'view', label: { ar: 'عرض سجل التدقيق', en: 'View audit logs' }, description: { ar: 'عرض سجل التدقيق', en: 'View audit logs' } },
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  super_admin: [],
  platform_admin: [
    'users.manage.view', 'users.manage.update', 'users.manage.suspend',
    'roles.manage.view', 'roles.manage.create', 'roles.manage.update', 'roles.manage.delete',
    'permissions.manage.view',
    'merchants.manage.view', 'merchants.manage.create', 'merchants.manage.update', 'merchants.manage.approve', 'merchants.manage.suspend',
    'stores.manage.view', 'stores.manage.create', 'stores.manage.update', 'stores.manage.suspend',
    'products.manage.view',
    'inventory.manage.view',
    'orders.manage.view', 'orders.shipping.view',
    'payments.manage.view',
    'payouts.manage.view',
    'shipping.manage.view',
    'coupons.manage.view',
    'promotions.manage.view',
    'notifications.manage.view',
    'reports.finance.view', 'reports.sales.view', 'reports.operations.view',
    'settings.manage.view',
    'audit_logs.entries.view',
  ],
  merchant: [
    'products.manage.view', 'products.manage.create', 'products.manage.update', 'products.manage.delete', 'products.manage.publish',
    'inventory.manage.view', 'inventory.manage.update', 'inventory.manage.adjust',
    'orders.manage.view', 'orders.manage.update', 'orders.shipping.view',
    'payouts.manage.view',
    'coupons.manage.view', 'coupons.manage.create', 'coupons.manage.update', 'coupons.manage.delete',
    'promotions.manage.view', 'promotions.manage.create', 'promotions.manage.update', 'promotions.manage.delete',
    'shipping.manage.view', 'shipping.manage.create', 'shipping.manage.update',
    'reports.sales.view',
    'settings.manage.view',
  ],
  merchant_staff: [],
  customer: ['users.profile.view', 'users.profile.update'],
  support_agent: [
    'users.manage.view',
    'orders.manage.view', 'orders.shipping.view',
    'audit_logs.entries.view',
  ],
  finance_admin: [
    'payments.manage.view', 'payments.manage.refund',
    'payouts.manage.view', 'payouts.manage.approve', 'payouts.manage.reject',
    'reports.finance.view',
    'audit_logs.entries.view',
  ],
  shipping_agent: [
    'shipping.manage.view', 'shipping.manage.create', 'shipping.manage.update', 'shipping.manage.delete',
    'orders.shipping.view',
  ],
};

async function main() {
  console.log('Seeding database...');

  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedSuperAdmin();
  await seedTaxClasses();
  await seedCurrencies();
  await seedCountryTaxRules();
  await seedLedgerAccounts();
  await seedSettings();

  console.log('Seeding complete.');
}

async function seedRoles() {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { label: role.label, description: role.description },
      create: role,
    });
  }
  console.log(`  Seeded ${SYSTEM_ROLES.length} roles.`);
}

async function seedPermissions() {
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        resource: perm.resource,
        action: perm.action,
        label: perm.label,
        description: perm.description,
      },
      create: perm,
    });
  }
  console.log(`  Seeded ${SYSTEM_PERMISSIONS.length} permissions.`);
}

async function seedRolePermissions() {
  let count = 0;
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;

    if (roleCode === 'super_admin') continue;

    for (const permCode of permCodes) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
      count++;
    }
  }
  console.log(`  Seeded ${count} role-permission assignments.`);
}

async function seedSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const supabaseUserId = process.env.SUPERADMIN_SUPABASE_USER_ID;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !supabaseUserId) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { supabaseUserId },
  });

  if (existingUser) {
    const superAdminRole = await prisma.role.findUnique({ where: { code: 'super_admin' } });
    if (!superAdminRole) return;

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: existingUser.id, roleId: superAdminRole.id },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: existingUser.id, roleId: superAdminRole.id },
      });
      console.log('  Assigned super_admin role to existing user.');
    }

    const existingScope = await prisma.userAccessScope.findFirst({
      where: { userId: existingUser.id, scopeType: 'platform', source: 'role' },
    });
    if (!existingScope) {
      await prisma.userAccessScope.create({
        data: { userId: existingUser.id, scopeType: 'platform', source: 'role' },
      });
      console.log('  Created platform access scope for super admin.');
    }
    return;
  }

  if (!password) {
    console.log('  SUPERADMIN_PASSWORD not set; skipping super admin creation.');
    return;
  }

  const newUser = await prisma.user.create({
    data: {
      supabaseUserId,
      email,
      firstName: 'Super',
      lastName: 'Admin',
      preferredLanguage: 'en',
      defaultCurrency: 'USD',
      status: 'active',
    },
  });

  const superAdminRole = await prisma.role.findUnique({ where: { code: 'super_admin' } });
  if (superAdminRole) {
    await prisma.userRole.create({
      data: { userId: newUser.id, roleId: superAdminRole.id },
    });
    await prisma.userAccessScope.create({
      data: { userId: newUser.id, scopeType: 'platform', source: 'role' },
    });
  }

  console.log(`  Created Super Admin user ${newUser.id}.`);
}

async function seedTaxClasses() {
  const classes = [
    { code: 'standard', name: { ar: 'قياسي', en: 'Standard' }, description: { ar: 'السعر القياسي للضريبة', en: 'Standard tax rate' } },
    { code: 'reduced', name: { ar: 'مخفض', en: 'Reduced' }, description: { ar: 'سعر ضريبي مخفض', en: 'Reduced tax rate' } },
    { code: 'exempt', name: { ar: 'معفى', en: 'Exempt' }, description: { ar: 'معفى من الضريبة', en: 'Tax exempt' } },
  ];

  for (const cls of classes) {
    await prisma.taxClass.upsert({
      where: { code: cls.code },
      update: { name: cls.name, description: cls.description },
      create: cls,
    });
  }
  console.log(`  Seeded ${classes.length} tax classes.`);
}

async function seedCurrencies() {
  const currencies = [
    { code: 'SAR', name: { ar: 'ريال سعودي', en: 'Saudi Riyal' }, symbol: 'ر.س.', decimalDigits: 2, isDefault: true, isActive: true },
    { code: 'AED', name: { ar: 'درهم إماراتي', en: 'UAE Dirham' }, symbol: 'د.إ', decimalDigits: 2, isDefault: false, isActive: true },
    { code: 'EGP', name: { ar: 'جنيه مصري', en: 'Egyptian Pound' }, symbol: 'ج.م.', decimalDigits: 2, isDefault: false, isActive: true },
    { code: 'KWD', name: { ar: 'دينار كويتي', en: 'Kuwaiti Dinar' }, symbol: 'د.ك', decimalDigits: 3, isDefault: false, isActive: true },
    { code: 'BHD', name: { ar: 'دينار بحريني', en: 'Bahraini Dinar' }, symbol: 'د.ب', decimalDigits: 3, isDefault: false, isActive: true },
    { code: 'QAR', name: { ar: 'ريال قطري', en: 'Qatari Riyal' }, symbol: 'ر.ق', decimalDigits: 2, isDefault: false, isActive: true },
    { code: 'OMR', name: { ar: 'ريال عماني', en: 'Omani Rial' }, symbol: 'ر.ع.', decimalDigits: 3, isDefault: false, isActive: true },
    { code: 'USD', name: { ar: 'دولار أمريكي', en: 'US Dollar' }, symbol: '$', decimalDigits: 2, isDefault: false, isActive: true },
  ];

  for (const cur of currencies) {
    await prisma.currency.upsert({
      where: { code: cur.code },
      update: { name: cur.name, symbol: cur.symbol, isDefault: cur.isDefault },
      create: cur,
    });
  }
  console.log(`  Seeded ${currencies.length} currencies.`);
}

async function seedCountryTaxRules() {
  const standardClass = await prisma.taxClass.findUnique({ where: { code: 'standard' } });
  if (!standardClass) return;

  const rules = [
    { countryCode: 'SA', ratePercent: 15.0, effectiveFrom: new Date('2018-01-01') },
    { countryCode: 'AE', ratePercent: 5.0, effectiveFrom: new Date('2018-01-01') },
    { countryCode: 'EG', ratePercent: 14.0, effectiveFrom: new Date('2018-01-01') },
    { countryCode: 'KW', ratePercent: 0.0, effectiveFrom: new Date('2018-01-01') },
    { countryCode: 'BH', ratePercent: 10.0, effectiveFrom: new Date('2019-01-01') },
    { countryCode: 'QA', ratePercent: 0.0, effectiveFrom: new Date('2018-01-01') },
    { countryCode: 'OM', ratePercent: 5.0, effectiveFrom: new Date('2021-04-16') },
    { countryCode: 'US', ratePercent: 0.0, effectiveFrom: new Date('2018-01-01') },
  ];

  for (const rule of rules) {
    await prisma.countryTaxRule.upsert({
      where: {
        countryCode_taxClassId_effectiveFrom: {
          countryCode: rule.countryCode,
          taxClassId: standardClass.id,
          effectiveFrom: rule.effectiveFrom,
        },
      },
      update: { ratePercent: rule.ratePercent },
      create: {
        countryCode: rule.countryCode,
        taxClassId: standardClass.id,
        ratePercent: rule.ratePercent,
        effectiveFrom: rule.effectiveFrom,
      },
    });
  }
  console.log(`  Seeded ${rules.length} country tax rules.`);
}

async function seedLedgerAccounts() {
  const sar = await prisma.currency.findUnique({ where: { code: 'SAR' } });
  const egp = await prisma.currency.findUnique({ where: { code: 'EGP' } });
  if (!sar || !egp) return;

  const accounts = [
    { code: 'platform.cash.SAR', name: { ar: 'النقدية - ريال', en: 'Cash - SAR' }, type: 'asset', ownerKind: 'platform', currencyCode: 'SAR' },
    { code: 'platform.cash.EGP', name: { ar: 'النقدية - جنيه', en: 'Cash - EGP' }, type: 'asset', ownerKind: 'platform', currencyCode: 'EGP' },
    { code: 'platform.commission_revenue.SAR', name: { ar: 'إيرادات العمولة - ريال', en: 'Commission Revenue - SAR' }, type: 'revenue', ownerKind: 'platform', currencyCode: 'SAR' },
    { code: 'platform.commission_revenue.EGP', name: { ar: 'إيرادات العمولة - جنيه', en: 'Commission Revenue - EGP' }, type: 'revenue', ownerKind: 'platform', currencyCode: 'EGP' },
    { code: 'platform.refunds.SAR', name: { ar: 'المستردات - ريال', en: 'Refunds - SAR' }, type: 'expense', ownerKind: 'platform', currencyCode: 'SAR' },
    { code: 'platform.refunds.EGP', name: { ar: 'المستردات - جنيه', en: 'Refunds - EGP' }, type: 'expense', ownerKind: 'platform', currencyCode: 'EGP' },
  ];

  for (const acc of accounts) {
    await prisma.ledgerAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name },
      create: acc,
    });
  }
  console.log(`  Seeded ${accounts.length} ledger accounts.`);
}

async function seedSettings() {
  const settings = [
    { key: 'platform.foundation.version', value: '0.2.0', isSecret: false, description: { ar: 'إصدار المنصة الأساسية', en: 'Platform foundation version' } },
    { key: 'platform.cors.origins', value: process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002', isSecret: false, description: { ar: 'أصول CORS المسموح بها', en: 'Allowed CORS origins' } },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: {
        key_merchantId: { key: setting.key, merchantId: null },
      },
      update: { value: setting.value as Prisma.InputJsonValue },
      create: {
        key: setting.key,
        merchantId: null,
        value: setting.value as Prisma.InputJsonValue,
        isSecret: setting.isSecret,
        description: setting.description as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`  Seeded ${settings.length} settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
