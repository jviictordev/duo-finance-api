import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ActivityType, TransactionType } from '@prisma/client';
import { monthKey, monthRange } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { EmergencyFundService } from '../emergency-fund/emergency-fund.service';

@Injectable()
export class MonthClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fund: EmergencyFundService,
    private readonly activity: ActivityService,
  ) {}

  private async compute(spaceId: string, month: string) {
    const { start, end } = monthRange(month);

    const totals = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { spaceId, occurredAt: { gte: start, lt: end } },
      _sum: { amountCents: true },
    });
    const netIncomeCents =
      totals.find((t) => t.type === TransactionType.INCOME)?._sum.amountCents ??
      0n;
    const spentCents =
      totals.find((t) => t.type === TransactionType.EXPENSE)?._sum
        .amountCents ?? 0n;

    const perCategory = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        spaceId,
        type: TransactionType.EXPENSE,
        occurredAt: { gte: start, lt: end },
      },
      _sum: { amountCents: true },
    });
    const categories = await this.prisma.category.findMany({
      where: { spaceId },
      select: { id: true, name: true, essential: true, icon: true },
    });
    const byCategory = perCategory.map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      return {
        categoryId: p.categoryId,
        name: cat?.name ?? 'Sem categoria',
        essential: cat?.essential ?? false,
        icon: cat?.icon ?? null,
        spentCents: (p._sum.amountCents ?? 0n).toString(),
      };
    });

    return {
      netIncomeCents,
      spentCents,
      leftoverCents: netIncomeCents - spentCents,
      byCategory,
    };
  }

  async get(spaceId: string, month?: string) {
    const key = month ?? monthKey(new Date());
    const existing = await this.prisma.monthClosing.findUnique({
      where: { spaceId_month: { spaceId, month: key } },
      include: {
        closedBy: { select: { id: true, name: true } },
        fundMovement: true,
      },
    });

    if (existing) {
      return {
        month: key,
        status: 'CLOSED' as const,
        netIncomeCents: existing.netIncomeCents.toString(),
        spentCents: existing.spentCents.toString(),
        leftoverCents: existing.leftoverCents.toString(),
        contributionCents: existing.contributionCents.toString(),
        byCategory: existing.byCategory,
        closedBy: existing.closedBy,
        closedAt: existing.closedAt,
      };
    }

    const preview = await this.compute(spaceId, key);
    return {
      month: key,
      status: 'OPEN' as const,
      netIncomeCents: preview.netIncomeCents.toString(),
      spentCents: preview.spentCents.toString(),
      leftoverCents: preview.leftoverCents.toString(),
      contributionCents:
        preview.leftoverCents > 0n ? preview.leftoverCents.toString() : '0',
      byCategory: preview.byCategory,
    };
  }

  async close(
    spaceId: string,
    userId: string,
    input: { month: string; contributionCents?: bigint },
  ) {
    const nowKey = monthKey(new Date());
    if (input.month >= nowKey) {
      throw new BadRequestException(
        'Só é possível fechar meses já encerrados.',
      );
    }

    const already = await this.prisma.monthClosing.findUnique({
      where: { spaceId_month: { spaceId, month: input.month } },
      select: { id: true },
    });
    if (already) throw new ConflictException('Mês já fechado.');

    const computed = await this.compute(spaceId, input.month);
    const contributionCents =
      input.contributionCents ??
      (computed.leftoverCents > 0n ? computed.leftoverCents : 0n);
    if (contributionCents < 0n) {
      throw new BadRequestException('Aporte não pode ser negativo.');
    }

    const closing = await this.prisma.$transaction(async (tx) => {
      const created = await tx.monthClosing.create({
        data: {
          spaceId,
          month: input.month,
          netIncomeCents: computed.netIncomeCents,
          spentCents: computed.spentCents,
          leftoverCents: computed.leftoverCents,
          contributionCents,
          byCategory: computed.byCategory,
          closedById: userId,
        },
      });
      await this.fund.autoContribution(
        spaceId,
        userId,
        contributionCents,
        created.id,
        tx,
      );
      return created;
    });

    await this.activity.record({
      spaceId,
      type: ActivityType.MONTH_CLOSED,
      actorId: userId,
      payload: {
        month: input.month,
        contributionCents: contributionCents.toString(),
        leftoverCents: computed.leftoverCents.toString(),
        text: `fechou ${input.month} — R$ ${(Number(contributionCents) / 100).toFixed(2)} para a reserva`,
      },
    });

    return this.get(spaceId, closing.month);
  }
}
