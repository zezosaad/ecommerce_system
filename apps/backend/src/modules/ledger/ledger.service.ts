import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';

export interface LedgerEntryInput {
  accountId: string;
  direction: 'debit' | 'credit';
  amount: number;
  currencyCode: string;
  description?: string;
  correlationId: string;
  metadata?: unknown;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private prisma: PrismaService) {}

  async write(transactionId: string, entries: LedgerEntryInput[]): Promise<void> {
    if (entries.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'At least one ledger entry is required.',
      });
    }

    const byCurrency = new Map<string, { debits: number; credits: number }>();
    for (const entry of entries) {
      const current = byCurrency.get(entry.currencyCode) ?? {
        debits: 0,
        credits: 0,
      };
      if (entry.direction === 'debit') {
        current.debits += entry.amount;
      } else {
        current.credits += entry.amount;
      }
      byCurrency.set(entry.currencyCode, current);
    }

    const currencyCodes = Array.from(byCurrency.keys());
    if (currencyCodes.length > 1) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_SEMANTIC_INCONSISTENT,
        message: 'All entries in a transaction must use the same currency.',
      });
    }

    const totals = byCurrency.get(currencyCodes[0])!;
    if (totals.debits !== totals.credits) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_SEMANTIC_INCONSISTENT,
        message: `Debits (${totals.debits}) must equal credits (${totals.credits}) per currency.`,
      });
    }

    await this.prisma.withTransaction(async (tx) => {
      for (const entry of entries) {
        await tx.ledgerEntry.create({
          data: {
            transactionId,
            accountId: entry.accountId,
            direction: entry.direction,
            amount: entry.amount,
            currencyCode: entry.currencyCode,
            description: entry.description ?? null,
            correlationId: entry.correlationId,
            metadata: entry.metadata ?? undefined,
          },
        });
      }
    });

    this.logger.log(
      `Ledger transaction ${transactionId} written with ${entries.length} entries.`,
    );
  }
}
