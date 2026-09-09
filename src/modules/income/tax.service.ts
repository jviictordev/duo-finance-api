import { Injectable } from '@nestjs/common';
import { TaxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface InssBracket {
  upToCents: number | null;
  rate: number;
}
interface IrrfBracket {
  upToCents: number | null;
  rate: number;
  deductionCents: number;
}

export interface NetBreakdown {
  grossCents: string;
  inssCents: string;
  irrfBaseCents: string;
  irrfCents: string;
  netCents: string;
  tables: { inss?: string; irrf?: string };
}

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  private async tableFor(type: TaxType, ref: Date) {
    return this.prisma.taxTable.findFirst({
      where: {
        type,
        effectiveFrom: { lte: ref },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: ref } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private inss(gross: bigint, brackets: InssBracket[]): bigint {
    let contribution = 0n;
    let lower = 0n;
    for (const bracket of brackets) {
      const cap =
        bracket.upToCents == null ? gross : BigInt(bracket.upToCents);
      const upper = gross < cap ? gross : cap;
      if (upper > lower) {
        contribution +=
          ((upper - lower) * BigInt(Math.round(bracket.rate * 10000))) / 10000n;
      }
      lower = cap;
      if (gross <= cap) break;
    }
    return contribution;
  }

  private irrf(base: bigint, brackets: IrrfBracket[]): bigint {
    let due = 0n;
    for (const bracket of brackets) {
      const cap =
        bracket.upToCents == null ? null : BigInt(bracket.upToCents);
      if (cap == null || base <= cap) {
        due =
          (base * BigInt(Math.round(bracket.rate * 10000))) / 10000n -
          BigInt(bracket.deductionCents);
        break;
      }
    }
    return due < 0n ? 0n : due;
  }

  async computeNet(
    grossCents: bigint,
    opts: { applyInss: boolean; applyIrrf: boolean; dependents: number },
    ref: Date = new Date(),
  ): Promise<NetBreakdown> {
    let inssCents = 0n;
    let irrfCents = 0n;
    let irrfBaseCents = 0n;
    const tables: { inss?: string; irrf?: string } = {};

    if (opts.applyInss) {
      const table = await this.tableFor(TaxType.INSS, ref);
      if (table) {
        inssCents = this.inss(
          grossCents,
          table.brackets as unknown as InssBracket[],
        );
        tables.inss = table.id;
      }
    }

    if (opts.applyIrrf) {
      const table = await this.tableFor(TaxType.IRRF, ref);
      if (table) {
        const perDependent = table.perDependentDeductionCents;
        irrfBaseCents =
          grossCents - inssCents - BigInt(opts.dependents) * perDependent;
        if (irrfBaseCents < 0n) irrfBaseCents = 0n;
        irrfCents = this.irrf(
          irrfBaseCents,
          table.brackets as unknown as IrrfBracket[],
        );
        tables.irrf = table.id;
      }
    }

    const netCents = grossCents - inssCents - irrfCents;
    return {
      grossCents: grossCents.toString(),
      inssCents: inssCents.toString(),
      irrfBaseCents: irrfBaseCents.toString(),
      irrfCents: irrfCents.toString(),
      netCents: netCents.toString(),
      tables,
    };
  }
}
