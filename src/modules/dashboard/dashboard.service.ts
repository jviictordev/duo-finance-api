import { Injectable } from '@nestjs/common';
import { TransactionType, TransactionVisibility } from '@prisma/client';
import { dayLabel, daysInMonth, monthKey, monthRange } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  async monthly(spaceId: string, month?: string) {
    const key = month ?? monthKey(new Date());
    const { start, end } = monthRange(key);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type', 'visibility'],
      where: { spaceId, occurredAt: { gte: start, lt: end } },
      _sum: { amountCents: true },
    });

    const sum = (
      type: TransactionType,
      visibility?: TransactionVisibility,
    ): bigint =>
      grouped
        .filter(
          (g) =>
            g.type === type &&
            (visibility ? g.visibility === visibility : true),
        )
        .reduce((acc, g) => acc + (g._sum.amountCents ?? 0n), 0n);

    const netIncomeCents = sum(TransactionType.INCOME);
    const spentCents = sum(TransactionType.EXPENSE);
    const coupleSpentCents = sum(
      TransactionType.EXPENSE,
      TransactionVisibility.SHARED,
    );
    const individualSpentCents = sum(
      TransactionType.EXPENSE,
      TransactionVisibility.PRIVATE,
    );
    const leftoverCents = netIncomeCents - spentCents;

    const now = new Date();
    const isCurrentMonth = monthKey(now) === key;
    const elapsedDays = isCurrentMonth ? now.getUTCDate() : daysInMonth(key);
    const perDayCents = spentCents / BigInt(Math.max(1, elapsedDays));

    // linhas agrupadas por dia (usa a mesma serialização de /transactions)
    const { items } = await this.transactions.list(spaceId, {
      month: key,
      take: 100,
    } as never);

    const byDay = new Map<string, { label: string; dateISO: string; items: unknown[] }>();
    for (const item of items as Array<{ occurredAt: Date }>) {
      const date = new Date(item.occurredAt);
      const dayISO = date.toISOString().slice(0, 10);
      if (!byDay.has(dayISO)) {
        byDay.set(dayISO, {
          label: dayLabel(date, now),
          dateISO: dayISO,
          items: [],
        });
      }
      byDay.get(dayISO)!.items.push(item);
    }

    return {
      month: key,
      summary: {
        netIncomeCents: netIncomeCents.toString(),
        spentCents: spentCents.toString(),
        leftoverCents: leftoverCents.toString(),
        perDayCents: perDayCents.toString(),
        coupleSpentCents: coupleSpentCents.toString(),
        individualSpentCents: individualSpentCents.toString(),
      },
      days: [...byDay.values()].sort((a, b) =>
        a.dateISO < b.dateISO ? 1 : -1,
      ),
    };
  }
}
