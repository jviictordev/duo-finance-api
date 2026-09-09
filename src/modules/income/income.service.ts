import { Injectable } from '@nestjs/common';
import { IncomeKind, TransactionType } from '@prisma/client';
import { addMonths, monthKey, monthRange } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxService } from './tax.service';

interface IncomeSourceInput {
  id?: string;
  label: string;
  kind: IncomeKind;
  grossCents: bigint;
  applyInss: boolean;
  applyIrrf: boolean;
  dependents: number;
}

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tax: TaxService,
  ) {}

  /** Média das entradas dos últimos 3 meses fechados (para renda VARIABLE). */
  private async variableBase(spaceId: string, userId: string): Promise<bigint> {
    const now = new Date();
    let total = 0n;
    for (let i = 1; i <= 3; i += 1) {
      const { start, end } = monthRange(monthKey(addMonths(now, -i)));
      const agg = await this.prisma.transaction.aggregate({
        where: {
          spaceId,
          createdById: userId,
          type: TransactionType.INCOME,
          occurredAt: { gte: start, lt: end },
        },
        _sum: { amountCents: true },
      });
      total += agg._sum.amountCents ?? 0n;
    }
    return total / 3n;
  }

  async summary(spaceId: string, userIds: string[]) {
    const sources = await this.prisma.incomeSource.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'asc' },
    });

    const perSource = await Promise.all(
      sources.map(async (s) => {
        const grossCents =
          s.kind === IncomeKind.VARIABLE
            ? await this.variableBase(spaceId, s.userId)
            : s.grossCents;
        const net = await this.tax.computeNet(grossCents, {
          applyInss: s.applyInss,
          applyIrrf: s.applyIrrf,
          dependents: s.dependents,
        });
        return {
          id: s.id,
          userId: s.userId,
          label: s.label,
          kind: s.kind,
          applyInss: s.applyInss,
          applyIrrf: s.applyIrrf,
          dependents: s.dependents,
          ...net,
        };
      }),
    );

    const totalNetCents = perSource
      .reduce((acc, s) => acc + BigInt(s.netCents), 0n)
      .toString();
    const totalGrossCents = perSource
      .reduce((acc, s) => acc + BigInt(s.grossCents), 0n)
      .toString();

    return { sources: perSource, totalGrossCents, totalNetCents };
  }

  async replaceSources(userId: string, sources: IncomeSourceInput[]) {
    await this.prisma.$transaction([
      this.prisma.incomeSource.deleteMany({ where: { userId } }),
      this.prisma.incomeSource.createMany({
        data: sources.map((s) => ({
          userId,
          label: s.label,
          kind: s.kind,
          grossCents: s.grossCents,
          applyInss: s.applyInss,
          applyIrrf: s.applyIrrf,
          dependents: s.dependents,
        })),
      }),
    ]);
    return this.prisma.incomeSource.findMany({ where: { userId } });
  }
}
