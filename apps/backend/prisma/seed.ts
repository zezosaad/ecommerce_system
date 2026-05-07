import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedTaxClasses();
  await seedCurrencies();
  await seedCountryTaxRules();
  await seedLedgerAccounts();
  await seedSettings();

  console.log('Seeding complete.');
}

async function seedRoles() {
  const roles = [
    { code: 'super_admin', label: { ar: 'المدير العام', en: 'Super Admin' }, description: { ar: 'وصول كامل إلى جميع وظائف النظام', en: 'Full access to all system functions' }, isSystem: true },
    { code: 'platform_admin', label: { ar: 'مدير المنصة', en: 'Platform Admin' }, description: { ar: 'إدارة المنصة والإعدادات', en: 'Platform management and settings' }, isSystem: true },
    { code: 'merchant_owner', label: { ar: 'صاحب المتجر', en: 'Merchant Owner' }, description: { ar: 'إدارة كاملة للمتجر', en: 'Full store management' }, isSystem: true },
    { code: 'merchant_staff', label: { ar: 'موظف المتجر', en: 'Merchant Staff' }, description: { ar: 'وصول محدود لإدارة المتجر', en: 'Limited store management access' }, isSystem: true },
    { code: 'customer', label: { ar: 'عميل', en: 'Customer' }, description: { ar: 'تصفح وشراء المنتجات', en: 'Browse and purchase products' }, isSystem: true },
    { code: 'support_agent', label: { ar: 'وكيل الدعم', en: 'Support Agent' }, description: { ar: 'تقديم الدعم للعملاء', en: 'Customer support' }, isSystem: true },
    { code: 'finance_admin', label: { ar: 'المدير المالي', en: 'Finance Admin' }, description: { ar: 'إدارة الشؤون المالية', en: 'Financial management' }, isSystem: true },
    { code: 'shipping_agent', label: { ar: 'وكيل الشحن', en: 'Shipping Agent' }, description: { ar: 'إدارة الشحن والتوصيل', en: 'Shipping and delivery management' }, isSystem: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { label: role.label, description: role.description },
      create: role,
    });
  }
  console.log(`  Seeded ${roles.length} roles.`);
}

async function seedPermissions() {
  const permissions = [
    { code: 'platform.settings.read', description: { ar: 'قراءة إعدادات المنصة', en: 'Read platform settings' } },
    { code: 'platform.settings.update', description: { ar: 'تحديث إعدادات المنصة', en: 'Update platform settings' } },
    { code: 'platform.audit.read', description: { ar: 'قراءة سجل المراجعة', en: 'Read audit log' } },
    { code: 'platform.users.read', description: { ar: 'قراءة بيانات المستخدمين', en: 'Read user data' } },
    { code: 'platform.roles.read', description: { ar: 'قراءة الأدوار', en: 'Read roles' } },
    { code: 'platform.permissions.read', description: { ar: 'قراءة الصلاحيات', en: 'Read permissions' } },
    { code: 'platform.currencies.read', description: { ar: 'قراءة العملات', en: 'Read currencies' } },
    { code: 'platform.tax.read', description: { ar: 'قراءة الضرائب', en: 'Read tax data' } },
    { code: 'merchant.profile.read', description: { ar: 'قراءة ملف التاجر', en: 'Read merchant profile' } },
    { code: 'customer.profile.read', description: { ar: 'قراءة ملف العميل', en: 'Read customer profile' } },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log(`  Seeded ${permissions.length} permissions.`);
}

async function seedRolePermissions() {
  const assignments: [string, string[]][] = [
    ['super_admin', ['platform.settings.read', 'platform.settings.update', 'platform.audit.read', 'platform.users.read', 'platform.roles.read', 'platform.permissions.read', 'platform.currencies.read', 'platform.tax.read', 'merchant.profile.read', 'customer.profile.read']],
    ['platform_admin', ['platform.settings.read', 'platform.audit.read', 'platform.users.read', 'platform.roles.read', 'platform.permissions.read', 'platform.currencies.read', 'platform.tax.read']],
    ['finance_admin', ['platform.audit.read']],
    ['support_agent', ['platform.audit.read', 'platform.users.read']],
    ['merchant_owner', ['merchant.profile.read']],
    ['merchant_staff', ['merchant.profile.read']],
    ['customer', ['customer.profile.read']],
    ['shipping_agent', []],
  ];

  let count = 0;
  for (const [roleCode, permCodes] of assignments) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;

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
    { key: 'platform.foundation.version', value: '0.1.0', isSecret: false, description: { ar: 'إصدار المنصة الأساسية', en: 'Platform foundation version' } },
    { key: 'platform.cors.origins', value: process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002', isSecret: false, description: { ar: 'أصول CORS المسموح بها', en: 'Allowed CORS origins' } },
  ];

  // Global settings (merchant_id IS NULL) cannot be upserted via the
  // composite unique because Prisma rejects nullable fields in `where`.
  // Use find-then-create/update keyed by `key` with a NULL merchant filter.
  for (const setting of settings) {
    const existing = await prisma.setting.findFirst({
      where: { key: setting.key, merchantId: null, deletedAt: null },
    });
    if (existing) {
      await prisma.setting.update({
        where: { id: existing.id },
        data: { value: setting.value },
      });
    } else {
      await prisma.setting.create({
        data: {
          key: setting.key,
          merchantId: null,
          value: setting.value,
          isSecret: setting.isSecret,
          description: setting.description,
        },
      });
    }
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
