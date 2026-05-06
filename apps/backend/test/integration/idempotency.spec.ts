import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computeBodyHash,
} from '../../src/modules/common/idempotency/canonicalize';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';

describe('Idempotency — canonicalization (research R7)', () => {
  it('canonicalizes object key ordering deterministically', () => {
    const a = canonicalizeJson({ b: 2, a: 1 });
    const b = canonicalizeJson({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('produces the same SHA-256 for logically equivalent payloads', async () => {
    const ha = await computeBodyHash({ x: 1, y: { b: 2, a: 1 } });
    const hb = await computeBodyHash({ y: { a: 1, b: 2 }, x: 1 });
    expect(ha).toBe(hb);
    expect(ha).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different payloads', async () => {
    const h1 = await computeBodyHash({ amount: 100 });
    const h2 = await computeBodyHash({ amount: 101 });
    expect(h1).not.toBe(h2);
  });

  it('handles arrays preserving order (positional)', () => {
    const a = canonicalizeJson([1, 2, 3]);
    const b = canonicalizeJson([3, 2, 1]);
    expect(a).not.toBe(b);
  });

  it('handles nested null/undefined values', async () => {
    const h1 = await computeBodyHash({ a: null });
    const h2 = await computeBodyHash({ a: null });
    expect(h1).toBe(h2);
  });

  it('handles unicode normalization (NFC)', async () => {
    // Two byte sequences that decode to the same NFC code point.
    const composed = 'é'; // é (composed)
    const decomposed = 'é'; // e + combining acute
    const h1 = await computeBodyHash({ name: composed });
    const h2 = await computeBodyHash({ name: decomposed });
    expect(h1).toBe(h2);
  });
});

describe('Idempotency — error contract', () => {
  it('exposes IDEMPOTENCY.CONFLICT (HTTP 409) for body-hash mismatch', () => {
    expect(ErrorCode.IDEMPOTENCY_CONFLICT).toBe('IDEMPOTENCY.CONFLICT');
  });

  it('exposes IDEMPOTENCY.MISSING (HTTP 400) for required-key omission', () => {
    expect(ErrorCode.IDEMPOTENCY_MISSING).toBe('IDEMPOTENCY.MISSING');
  });

  it('the two codes are distinct strings', () => {
    expect(ErrorCode.IDEMPOTENCY_CONFLICT).not.toBe(
      ErrorCode.IDEMPOTENCY_MISSING,
    );
  });
});
