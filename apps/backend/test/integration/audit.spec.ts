import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../../src/modules/audit/audit.service';

interface FakePrisma {
  auditLog: { create: ReturnType<typeof vi.fn> };
}

function makePrisma(): FakePrisma {
  return {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('AuditService.write — payload shape (research R2 / FR-SEC-004)', () => {
  it('writes a row with all the required fields', async () => {
    const prisma = makePrisma();
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorUserId: 'user-1',
      actorRoleCodes: ['platform_admin'],
      actionCode: 'platform.settings.read',
      targetType: 'Setting',
      targetId: 'platform.foundation.version',
      correlationId: 'req-abc-123',
      severity: 'info',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const args = prisma.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.actorUserId).toBe('user-1');
    expect(args.data.actorRoleCodes).toEqual(['platform_admin']);
    expect(args.data.actionCode).toBe('platform.settings.read');
    expect(args.data.targetType).toBe('Setting');
    expect(args.data.targetId).toBe('platform.foundation.version');
    expect(args.data.correlationId).toBe('req-abc-123');
    expect(args.data.severity).toBe('info');
  });

  it('snapshots actorRoleCodes from the auth context (not by foreign key)', async () => {
    // The role code snapshot is the durable record of "what they could do
    // at the time" — it MUST be persisted as text[], not as a join.
    const prisma = makePrisma();
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorRoleCodes: ['merchant_owner', 'merchant_staff'],
      actionCode: 'merchant.products.created',
      correlationId: 'req-1',
    });

    const args = prisma.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.actorRoleCodes).toEqual([
      'merchant_owner',
      'merchant_staff',
    ]);
  });

  it('truncates long user agents to 512 chars (header-injection guard)', async () => {
    const prisma = makePrisma();
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorRoleCodes: [],
      actionCode: 'platform.settings.read',
      correlationId: 'req-1',
      userAgent: 'A'.repeat(2000),
    });

    const args = prisma.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect((args.data.userAgent as string).length).toBe(512);
  });

  it('defaults severity to info when omitted', async () => {
    const prisma = makePrisma();
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorRoleCodes: [],
      actionCode: 'platform.settings.read',
      correlationId: 'req-1',
    });

    const args = prisma.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.severity).toBe('info');
  });

  it('preserves before/after JSONB diffs when provided', async () => {
    const prisma = makePrisma();
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorRoleCodes: ['platform_admin'],
      actionCode: 'platform.settings.updated',
      correlationId: 'req-1',
      before: { value: 'a' },
      after:  { value: 'b' },
    });

    const args = prisma.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.before).toEqual({ value: 'a' });
    expect(args.data.after).toEqual({ value: 'b' });
  });

  it('does not throw when the underlying write fails (audit must not break the user request)', async () => {
    const prisma: FakePrisma = {
      auditLog: { create: vi.fn().mockRejectedValue(new Error('db down')) },
    };
    const svc = new AuditService(prisma as never);

    // The contract is: AuditService.write swallows infrastructure errors,
    // logs them, and never throws into the request path. A request flow
    // that fails to write an audit row should still complete.
    await expect(
      svc.write({
        actorRoleCodes: [],
        actionCode: 'platform.settings.read',
        correlationId: 'req-1',
      }),
    ).resolves.toBeUndefined();
  });
});
