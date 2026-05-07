import { describe, it, expect } from 'vitest';

const SECRET_PATTERNS: RegExp[] = [
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  /sbp_[a-zA-Z0-9]{40,}/,
  /service_role[_-]?key/i,
  /supabase[_-]?service[_-]?role[_-]?key/i,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /sk_live_[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/,
];

function scanForSecrets(payload: unknown, path = ''): string[] {
  const findings: string[] = [];

  if (typeof payload === 'string') {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(payload)) {
        findings.push(`${path} matched ${pattern}`);
      }
    }
  } else if (Array.isArray(payload)) {
    payload.forEach((item, index) => {
      findings.push(...scanForSecrets(item, `${path}[${index}]`));
    });
  } else if (payload !== null && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(key)) {
          findings.push(`${path}.${key} (key) matched ${pattern}`);
        }
      }
      findings.push(...scanForSecrets(value, path ? `${path}.${key}` : key));
    }
  }

  return findings;
}

describe('Audit log secret redaction (SC-011)', () => {
  it('clean audit payload passes with no findings', () => {
    const cleanPayloads = [
      { message: 'Role created', roleKey: 'catalog_reviewer', roleId: 'uuid-123' },
      { message: 'User status changed', from: 'active', to: 'suspended', reason: 'policy violation' },
      { message: 'Permission assigned', permissionKeys: ['products.manage.view'] },
      { message: 'Profile synced', source: 'webhook', email: 'user@example.com' },
      { message: 'Scope denied', requestedMerchantId: 'merchant-456', reason: 'cross-tenant' },
    ];

    for (const payload of cleanPayloads) {
      const findings = scanForSecrets(payload);
      expect(findings).toEqual([]);
    }
  });

  it('detects JWT in metadata', () => {
    const contaminated = {
      message: 'Manual override',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8',
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('detects service role key pattern', () => {
    // Build the Supabase-shaped fixture at runtime so committed source
    // doesn't carry a literal `sbp_` token that triggers GitHub's
    // secret-scanning push protection.
    const fakeSbp = ['sbp', 'abcdef1234567890'.repeat(3)].join('_');
    const contaminated = {
      message: 'Direct DB query',
      config: { supabase_service_role_key: fakeSbp },
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('detects SUPABASE_SERVICE_ROLE_KEY env var name in payload', () => {
    const contaminated = {
      message: 'Config dump',
      env: { SUPABASE_SERVICE_ROLE_KEY: 'some_value' },
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('detects private key material', () => {
    const contaminated = {
      message: 'Key material',
      key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('detects GitHub tokens', () => {
    // Built at runtime to avoid triggering GitHub's secret-scanning push
    // protection on the committed `ghp_…` literal.
    const fakeGhp = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789ab'].join('_');
    const contaminated = {
      message: 'CI config',
      token: fakeGhp,
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('scans nested objects and array elements', () => {
    // Build the Stripe-shaped fake fixture at runtime so GitHub's secret
    // scanner doesn't false-positive on the literal `sk_live_...` prefix
    // in committed source. The regex still matches at runtime.
    const fakeStripe = ['sk', 'live', 'a'.repeat(26)].join('_');
    const contaminated = {
      events: [
        { type: 'user.login', token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.eyJzdWIiOiIxMjM0NTY3ODkwMDEyMzQ1Njc4OTAifQ' },
        { type: 'user.logout', metadata: { serviceKey: fakeStripe } },
      ],
    };
    const findings = scanForSecrets(contaminated);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });
});
