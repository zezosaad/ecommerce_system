import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { ErrorCode } from '../../src/modules/common/errors/error-codes';

interface FakeTx {
  ledgerEntry: { create: ReturnType<typeof vi.fn> };
}

interface FakePrisma {
  withTransaction: <T>(fn: (tx: FakeTx) => Promise<T>) => Promise<T>;
  ledgerEntry: { create: ReturnType<typeof vi.fn> };
}

function makePrisma(): FakePrisma {
  const tx: FakeTx = {
    ledgerEntry: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    withTransaction: async <T>(fn: (tx: FakeTx) => Promise<T>) => fn(tx),
    ledgerEntry: tx.ledgerEntry,
  };
}

const baseEntry = {
  accountId: 'acct-1',
  amount: 100,
  currencyCode: 'SAR',
  correlationId: 'req-1',
};

describe('LedgerService.write — invariants (data-model.md)', () => {
  it('rejects empty entry list with VALIDATION.FAILED', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await expect(svc.write('tx-1', [])).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_FAILED },
    });
  });

  it('writes a balanced single-currency transaction (debit == credit)', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await svc.write('tx-1', [
      { ...baseEntry, direction: 'debit' },
      { ...baseEntry, accountId: 'acct-2', direction: 'credit' },
    ]);

    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
  });

  it('rejects unbalanced transaction with VALIDATION.SEMANTIC.INCONSISTENT', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await expect(
      svc.write('tx-1', [
        { ...baseEntry, direction: 'debit', amount: 100 },
        { ...baseEntry, accountId: 'acct-2', direction: 'credit', amount: 99 },
      ]),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_SEMANTIC_INCONSISTENT },
    });
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects mixed-currency transaction', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await expect(
      svc.write('tx-1', [
        { ...baseEntry, direction: 'debit', currencyCode: 'SAR', amount: 100 },
        { ...baseEntry, accountId: 'acct-2', direction: 'credit', currencyCode: 'EGP', amount: 100 },
      ]),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.VALIDATION_SEMANTIC_INCONSISTENT },
    });
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('balances multi-leg transactions (1 debit, 2 credits summing to debit)', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await svc.write('tx-1', [
      { ...baseEntry, direction: 'debit',  amount: 100 },
      { ...baseEntry, accountId: 'acct-2', direction: 'credit', amount: 60 },
      { ...baseEntry, accountId: 'acct-3', direction: 'credit', amount: 40 },
    ]);

    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(3);
  });

  it('writes via withTransaction (atomicity)', async () => {
    const prisma = makePrisma();
    const txSpy = vi.spyOn(prisma, 'withTransaction');
    const svc = new LedgerService(prisma as never);

    await svc.write('tx-1', [
      { ...baseEntry, direction: 'debit' },
      { ...baseEntry, accountId: 'acct-2', direction: 'credit' },
    ]);

    expect(txSpy).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestException for invariant failures (HTTP 400 path)', async () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);

    await expect(
      svc.write('tx-1', [
        { ...baseEntry, direction: 'debit', amount: 100 },
        { ...baseEntry, accountId: 'acct-2', direction: 'credit', amount: 50 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('LedgerService — public API surface', () => {
  it('does not expose a direct INSERT path; only write(transactionId, entries) is public', () => {
    const prisma = makePrisma();
    const svc = new LedgerService(prisma as never);
    const publicMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(svc),
    ).filter((m) => m !== 'constructor');
    // Only `write` is on the prototype. Any future addition would land
    // in this list and force a code review.
    expect(publicMethods).toEqual(['write']);
  });
});
