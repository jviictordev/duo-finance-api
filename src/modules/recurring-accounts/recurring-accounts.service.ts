import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  RecurrenceKind,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateRecurringAccountDto,
  PayRecurringAccountDto,
  UpdateRecurringAccountDto,
} from './recurring-accounts.dto';

@Injectable()
export class RecurringAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private remainingCents(a: {
    kind: RecurrenceKind;
    amountCents: bigint;
    installmentsCount: number | null;
    installmentsPaid: number | null;
  }): bigint {
    if (a.kind !== RecurrenceKind.INSTALLMENT || !a.installmentsCount) return 0n;
    const left = a.installmentsCount - (a.installmentsPaid ?? 0);
    return BigInt(Math.max(0, left)) * a.amountCents;
  }

  async list(spaceId: string) {
    const rows = await this.prisma.recurringAccount.findMany({
      where: { spaceId, archivedAt: null },
      orderBy: { dueDay: 'asc' },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        account: { select: { id: true, name: true } },
      },
    });

    const fixed = rows.filter((r) => r.kind === RecurrenceKind.FIXED);
    const installmentRows = rows.filter(
      (r) => r.kind === RecurrenceKind.INSTALLMENT,
    );

    const serialize = (r: (typeof rows)[number]) => ({
      id: r.id,
      label: r.label,
      kind: r.kind,
      amountCents: r.amountCents.toString(),
      dueDay: r.dueDay,
      category: r.category,
      account: r.account,
      installmentsCount: r.installmentsCount,
      installmentsPaid: r.installmentsPaid,
      remainingBalanceCents: this.remainingCents(r).toString(),
      progress:
        r.installmentsCount && r.installmentsCount > 0
          ? (r.installmentsPaid ?? 0) / r.installmentsCount
          : null,
    });

    const totalRemaining = installmentRows.reduce(
      (acc, r) => acc + this.remainingCents(r),
      0n,
    );

    return {
      fixed: fixed.map(serialize),
      monthlyFixedTotalCents: fixed
        .reduce((acc, r) => acc + r.amountCents, 0n)
        .toString(),
      installments: {
        totalRemainingCents: totalRemaining.toString(),
        items: installmentRows.map(serialize),
      },
    };
  }

  async create(spaceId: string, dto: CreateRecurringAccountDto) {
    if (
      dto.kind === RecurrenceKind.INSTALLMENT &&
      (!dto.installmentsCount || dto.installmentsCount < 1)
    ) {
      throw new BadRequestException(
        'Parcelamento exige installmentsCount >= 1.',
      );
    }
    return this.prisma.recurringAccount.create({
      data: {
        spaceId,
        label: dto.label,
        kind: dto.kind,
        amountCents: dto.amountCents,
        dueDay: dto.dueDay,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        installmentsCount: dto.installmentsCount,
        installmentsPaid: dto.installmentsPaid ?? 0,
        startDate: dto.startDate,
      },
    });
  }

  async update(spaceId: string, id: string, dto: UpdateRecurringAccountDto) {
    await this.ensureOwned(spaceId, id);
    return this.prisma.recurringAccount.update({
      where: { id },
      data: {
        label: dto.label,
        amountCents: dto.amountCents,
        dueDay: dto.dueDay,
        accountId: dto.accountId === null ? null : dto.accountId,
        categoryId: dto.categoryId === null ? null : dto.categoryId,
        installmentsPaid: dto.installmentsPaid,
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? new Date()
              : null,
      },
    });
  }

  async pay(
    spaceId: string,
    userId: string,
    id: string,
    dto: PayRecurringAccountDto,
  ) {
    const recurring = await this.prisma.recurringAccount.findFirst({
      where: { id, spaceId },
    });
    if (!recurring) throw new NotFoundException('Conta fixa não encontrada.');

    const accountId = dto.accountId ?? recurring.accountId;
    if (!accountId) {
      throw new BadRequestException(
        'Informe accountId — esta conta fixa não tem conta vinculada.',
      );
    }
    const amountCents = dto.amountCents ?? recurring.amountCents;

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          spaceId,
          type: TransactionType.EXPENSE,
          amountCents,
          description: recurring.label,
          occurredAt: dto.occurredAt,
          accountId,
          categoryId: recurring.categoryId,
          createdById: userId,
          paymentMethod: 'DEBIT',
          recurringAccountId: recurring.id,
        },
      });

      if (recurring.kind === RecurrenceKind.INSTALLMENT) {
        await tx.recurringAccount.update({
          where: { id: recurring.id },
          data: { installmentsPaid: { increment: 1 } },
        });
      }
      return transaction;
    });

    await this.activity.record({
      spaceId,
      type: ActivityType.TRANSACTION_CREATED,
      actorId: userId,
      payload: {
        transactionId: result.id,
        text: `pagou ${recurring.label} de R$ ${(Number(amountCents) / 100).toFixed(2)}`,
        amountCents: amountCents.toString(),
      },
    });

    return { transactionId: result.id };
  }

  async remove(spaceId: string, id: string): Promise<void> {
    await this.ensureOwned(spaceId, id);
    await this.prisma.recurringAccount.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  private async ensureOwned(spaceId: string, id: string): Promise<void> {
    const found = await this.prisma.recurringAccount.findFirst({
      where: { id, spaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Conta fixa não encontrada.');
  }
}
