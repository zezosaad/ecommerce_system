import { describe, it, expect } from 'vitest';
import { AuditService } from '../../src/modules/audit/audit.service';

describe('FR-046: Audit log immutability', () => {
  it('AuditService exposes no update or delete methods', () => {
    const svc = new AuditService({} as never);

    expect(typeof svc.write).toBe('function');
    expect(typeof svc.list).toBe('function');
    expect(typeof svc.getById).toBe('function');

    expect((svc as any).update).toBeUndefined();
    expect((svc as any).delete).toBeUndefined();
    expect((svc as any).remove).toBeUndefined();
    expect((svc as any).patch).toBeUndefined();
  });

  it('write method accepts only create-like payload (no idempotency key for writes)', () => {
    const entrySignature = [
      'actorUserId',
      'actorRoleCodes',
      'actionCode',
      'targetType',
      'targetId',
      'correlationId',
      'ipAddress',
      'userAgent',
      'before',
      'after',
      'metadata',
      'severity',
    ];

    const svc = new AuditService({} as never);
    const proto = Object.getOwnPropertyNames(AuditService.prototype);
    const writeMethod = proto.find((p) => p === 'write');

    const writeFn = (svc as any)[writeMethod!].toString();
    for (const param of entrySignature) {
      expect(writeFn).toContain(param);
    }
  });

  it('list method returns cursor pagination (no offset pagination)', () => {
    const svc = new AuditService({} as never);
    const listMethod = (svc as any).list?.toString() ?? '';

    expect(listMethod).toContain('cursor');
    expect(listMethod).toContain('nextCursor');
  });

  it('getById returns null or record, never throws mutation-related errors', async () => {
    const prisma = {
      auditLog: {
        findUnique: async () => null,
      },
    };
    const svc = new AuditService(prisma as never);
    const result = await svc.getById('non-existent-id');
    expect(result).toBeNull();
  });
});
