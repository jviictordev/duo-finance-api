import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivityType, FundMovementKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class EmergencyFundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private async fundId(spaceId: string): Promise<string> {
    const fund = await this.prisma.emergencyFund.upsert({
      where: { spaceId },
      create: { spaceId },
      update: {},
      select: { id: true },
    });
    return fund.id;
  }

  async get(spaceId: string) {
    const fund = await this.prisma.emergencyFund.upsert({
      where: { spaceId },
      create: { spaceId },
      update: {},
      include: {
        movements: {
          orderBy: { occurredAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const currentCents = fund.movements.reduce(
      (acc, m) => acc + m.amountCents,
      0n,
    );

    return {
      id: fund.id,
      targetCents: fund.targetCents.toString(),
      currentCents: currentCents.toString(),
      progress:
        fund.targetCents > 0n
          ? Math.min(1, Number(currentCents) / Number(fund.targetCents))
          : 0,
      movements: fund.movements.map((m) => ({
        id: m.id,
        amountCents: m.amountCents.toString(),
        kind: m.kind,
        note: m.note,
        createdBy: m.createdBy,
        occurredAt: m.occurredAt,
      })),
    };
  }

  async setTarget(spaceId: string, targetCents: bigint) {
    await this.prisma.emergencyFund.upsert({
      where: { spaceId },
      create: { spaceId, targetCents },
      update: { targetCents },
    });
    return this.get(spaceId);
  }

  async addMovement(
    spaceId: string,
    userId: string,
    input: { amountCents: bigint; note?: string },
  ) {
    if (input.amountCents === 0n) {
      throw new BadRequestException('Movimento não pode ser zero.');
    }
    const fundId = await this.fundId(spaceId);
    const movement = await this.prisma.emergencyFundMovement.create({
      data: {
        fundId,
        amountCents: input.amountCents,
        kind: FundMovementKind.MANUAL,
        note: input.note,
        createdById: userId,
      },
    });

    await this.activity.record({
      spaceId,
      type:
        input.amountCents > 0n
          ? ActivityType.FUND_CONTRIBUTION
          : ActivityType.FUND_WITHDRAWAL,
      actorId: userId,
      payload: {
        movementId: movement.id,
        amountCents: input.amountCents.toString(),
        text:
          input.amountCents > 0n
            ? `aportou R$ ${(Number(input.amountCents) / 100).toFixed(2)} na reserva`
            : `retirou R$ ${(Number(-input.amountCents) / 100).toFixed(2)} da reserva`,
      },
    });

    return this.get(spaceId);
  }

  /** Aporte automático disparado pelo fechamento de mês. */
  async autoContribution(
    spaceId: string,
    userId: string,
    amountCents: bigint,
    monthClosingId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (amountCents <= 0n) return;
    const fund = await tx.emergencyFund.upsert({
      where: { spaceId },
      create: { spaceId },
      update: {},
      select: { id: true },
    });
    await tx.emergencyFundMovement.create({
      data: {
        fundId: fund.id,
        amountCents,
        kind: FundMovementKind.AUTO_CLOSING,
        note: 'Sobrou e foi para a reserva',
        createdById: userId,
        monthClosingId,
      },
    });
  }
}
