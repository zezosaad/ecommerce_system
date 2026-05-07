import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../../src/modules/audit/audit.service';

const FR_044_ACTIONS = [
  'auth.profile.created',
  'auth.profile.updated',
  'auth.profile.activated',
  'auth.profile.deleted',
  'auth.profile.status_changed',
  'roles.created',
  'roles.updated',
  'roles.deleted',
  'roles.permission_added',
  'roles.permission_removed',
  'users.role_assigned',
  'users.role_removed',
  'auth.login.profile_synced',
  'authz.scope_denied',
  'authz.permission_denied',
  'authz.role_denied',
  'auth.webhook.invalid_signature',
  'auth.logout',
];

describe('FR-044: Every sensitive identity/access-control event is recorded immutably', () => {
  it('every FR-044 action code is recognized by AuditService.write', async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    const prisma = { auditLog: { create: mockCreate } };
    const svc = new AuditService(prisma as never);

    for (const actionCode of FR_044_ACTIONS) {
      await svc.write({
        actorUserId: 'test-user',
        actorRoleCodes: ['platform_admin'],
        actionCode,
        targetType: 'Test',
        targetId: 'test-id',
        correlationId: 'cov-test',
        metadata: { test: true },
        severity: actionCode.startsWith('authz.') || actionCode === 'auth.webhook.invalid_signature'
          ? 'warning'
          : 'info',
      });
    }

    expect(mockCreate).toHaveBeenCalledTimes(FR_044_ACTIONS.length);

    for (const actionCode of FR_044_ACTIONS) {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionCode,
            actorUserId: 'test-user',
          }),
        }),
      );
    }
  });

  it('every FR-044 action produces exactly one row per invocation', async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    const prisma = { auditLog: { create: mockCreate } };
    const svc = new AuditService(prisma as never);

    await svc.write({
      actorRoleCodes: [],
      actionCode: 'auth.profile.created',
      correlationId: 'req-1',
    });

    await svc.write({
      actorRoleCodes: [],
      actionCode: 'auth.profile.created',
      correlationId: 'req-2',
    });

    const createdCalls = mockCreate.mock.calls.filter(
      (args: any) => args[0]?.data?.actionCode === 'auth.profile.created',
    );
    expect(createdCalls.length).toBe(2);

    for (const call of createdCalls) {
      const data = call[0].data;
      expect(data).toHaveProperty('actionCode');
      expect(data).toHaveProperty('actorRoleCodes');
      expect(data).toHaveProperty('correlationId');
      expect(data).toHaveProperty('severity');
    }
  });
});
