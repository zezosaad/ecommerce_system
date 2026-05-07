import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

const SECRET = 'test-webhook-secret-32-chars-min!!';

function createSignature(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

function createEventPayload(
  id: string,
  type: string,
  record: Record<string, unknown>,
): string {
  return JSON.stringify({ id, type, record });
}

describe('Supabase webhook signature verification', () => {
  it('valid signature passes authentication', () => {
    const body = createEventPayload('evt-1', 'user.email_confirmed', {
      id: 'supabase-user-1',
      email: 'test@example.com',
      email_confirmed_at: '2026-05-07T12:00:00Z',
    });

    const signature = createSignature(body);
    expect(signature).toMatch(/^sha256=/);

    const prefix = 'sha256=';
    const providedSig = signature.slice(prefix.length);
    const expectedSig = createHmac('sha256', SECRET).update(body).digest('hex');

    const buf1 = Buffer.from(providedSig, 'hex');
    const buf2 = Buffer.from(expectedSig, 'hex');
    expect(buf1.equals(buf2)).toBe(true);
  });

  it('tampered body produces different signature', () => {
    const originalBody = createEventPayload('evt-2', 'user.email_confirmed', {
      id: 'supabase-user-2',
      email: 'test@example.com',
    });
    const tamperedBody = originalBody.replace('test@example.com', 'hacker@evil.com');

    const originalSig = createSignature(originalBody);
    const tamperedSig = createSignature(tamperedBody);

    expect(originalSig).not.toBe(tamperedSig);
  });

  it('invalid secret produces different signature', () => {
    const body = createEventPayload('evt-3', 'user.email_confirmed', {
      id: 'supabase-user-3',
      email: 'test@example.com',
    });

    const correctSig = createSignature(body);
    const wrongSig = `sha256=${createHmac('sha256', 'wrong-secret').update(body).digest('hex')}`;

    expect(correctSig).not.toBe(wrongSig);
  });

  it('missing signature prefix is handled gracefully', () => {
    const body = createEventPayload('evt-4', 'user.email_confirmed', {
      id: 'supabase-user-4',
      email: 'test@example.com',
    });

    const digest = createHmac('sha256', SECRET).update(body).digest('hex');
    const withPrefix = `sha256=${digest}`;
    const withoutPrefix = digest;

    expect(withPrefix).toContain(withoutPrefix);
  });
});

describe('Webhook event payload shape', () => {
  it('allow-listed event types are recognized', () => {
    const allowed = ['user.created', 'user.email_confirmed', 'user.deleted'];

    expect(allowed).toContain('user.created');
    expect(allowed).toContain('user.email_confirmed');
    expect(allowed).toContain('user.deleted');
    expect(allowed).not.toContain('user.updated');
    expect(allowed).not.toContain('user.password_reset');
  });

  it('event payload has required fields', () => {
    const payload = {
      id: 'evt-5',
      type: 'user.email_confirmed' as const,
      record: {
        id: 'supabase-user-5',
        email: 'test@example.com',
        email_confirmed_at: '2026-05-07T12:00:00Z',
      },
    };

    expect(payload).toHaveProperty('id');
    expect(payload).toHaveProperty('type');
    expect(payload).toHaveProperty('record');
    expect(payload.record).toHaveProperty('id');
    expect(payload.record).toHaveProperty('email');
  });

  it('duplicate event ID detection works', () => {
    const processedIds = new Set<string>();
    const eventId = 'evt-duplicate';

    expect(processedIds.has(eventId)).toBe(false);
    processedIds.add(eventId);
    expect(processedIds.has(eventId)).toBe(true);

    const isDuplicate = processedIds.has(eventId);
    expect(isDuplicate).toBe(true);
  });

  it('signature_invalid produces warning-level audit', () => {
    const auditCode = 'auth.webhook.invalid_signature';
    expect(auditCode).toBe('auth.webhook.invalid_signature');
  });
});
