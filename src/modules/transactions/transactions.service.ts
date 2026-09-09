import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { Money } from '../../common/money';
import { addMonths, monthRange } from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private async assertAccount(spaceId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, spaceId },
      select: { id: true },
    });
    if (!account) throw new BadRequestException('Conta inválida.');
  }

  private async assertCategory(spaceId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, spaceId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Categoria inválida.');
  }

  async create(spaceId: string, userId: string, dto: CreateTransactionDto) {
    await this.assertAccount(spaceId, dto.accountId);
    await this.assertCategory(spaceId, dto.categoryId);

    const parcelado = dto.installmentsCount > 1;
    if (parcelado && dto.paymentMethod !== 'CREDIT') {
      throw new BadRequestException('Parcelamento só é permitido no crédito.');
    }

    const ownerId = dto.visibility === 'PRIVATE' ? userId : null;

    const created = await this.prisma.$transaction(async (tx) => {
      if (!parcelado) {
        const transaction = await tx.transaction.create({
          data: {
            spaceId,
            type: dto.type as TransactionType,
            amountCents: dto.amountCents,
            description: dto.description,
            occurredAt: dto.occurredAt,
            accountId: dto.accountId,
            categoryId: dto.categoryId ?? null,
            createdById: userId,
            ownerId,
            visibility: dto.visibility,
            paymentMethod: dto.paymentMethod,
            needsDetail: dto.needsDetail,
            attachmentId: dto.attachmentId ?? null,
          },
        });
        return [transaction];
      }

      const parts = Money.fromCents(dto.amountCents).splitInto(
        dto.installmentsCount,
      );
      const plan = await tx.installmentPlan.create({
        data: {
          spaceId,
          description: dto.description,
          totalCents: dto.amountCents,
          installmentsCount: dto.installmentsCount,
          firstDueDate: dto.occurredAt,
          paymentMethod: 'CREDIT',
        },
      });

      const rows = [];
      for (let i = 0; i < dto.installmentsCount; i += 1) {
        rows.push(
          await tx.transaction.create({
            data: {
              spaceId,
              type: TransactionType.EXPENSE,
              amountCents: parts[i]!.cents,
              description: `${dto.description} (${i + 1}/${dto.installmentsCount})`,
              occurredAt: addMonths(dto.occurredAt, i),
              accountId: dto.accountId,
              categoryId: dto.categoryId ?? null,
              createdById: userId,
              ownerId,
              visibility: dto.visibility,
              paymentMethod: 'CREDIT',
              needsDetail: dto.needsDetail && i === 0,
              installmentPlanId: plan.id,
              installmentNumber: i + 1,
            },
          }),
        );
      }
      return rows;
    });

    const anchor = created[0]!;
    await this.activity.record({
      spaceId,
      type: ActivityType.TRANSACTION_CREATED,
      actorId: userId,
      payload: {
        transactionId: anchor.id,
        text: this.activityText(dto.type, dto.description, dto.amountCents),
        amountCents: dto.amountCents.toString(),
        installments: parcelado ? dto.installmentsCount : undefined,
      },
    });

    return this.detail(spaceId, anchor.id);
  }

  private activityText(type: string, description: string, cents: bigint): string {
    const verbo = type === 'INCOME' ? 'recebeu' : 'lançou';
    return `${verbo} ${description} de R$ ${(Number(cents) / 100).toFixed(2)}`;
  }

  async transfer(spaceId: string, userId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Contas de origem e destino iguais.');
    }
    await this.assertAccount(spaceId, dto.fromAccountId);
    await this.assertAccount(spaceId, dto.toAccountId);

    return this.prisma.$transaction(async (tx) => {
      const out = await tx.transaction.create({
        data: {
          spaceId,
          type: TransactionType.TRANSFER,
          amountCents: dto.amountCents,
          description: dto.description,
          occurredAt: dto.occurredAt,
          accountId: dto.fromAccountId,
          createdById: userId,
          paymentMethod: 'OTHER',
        },
      });
      const inbound = await tx.transaction.create({
        data: {
          spaceId,
          type: TransactionType.TRANSFER,
          amountCents: dto.amountCents,
          description: dto.description,
          occurredAt: dto.occurredAt,
          accountId: dto.toAccountId,
          createdById: userId,
          paymentMethod: 'OTHER',
          transferPairId: out.id,
        },
      });
      await tx.transaction.update({
        where: { id: out.id },
        data: { transferPairId: inbound.id },
      });
      return { outId: out.id, inId: inbound.id };
    });
  }

  async list(spaceId: string, query: ListTransactionsQueryDto) {
    const where: Prisma.TransactionWhereInput = { spaceId };

    if (query.month) {
      const { start, end } = monthRange(query.month);
      where.occurredAt = { gte: start, lt: end };
    } else if (query.from || query.to) {
      where.occurredAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        category: { select: { id: true, name: true, icon: true, essential: true } },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        account: { select: { id: true, name: true } },
        installmentPlan: true,
        _count: { select: { comments: true } },
      },
    });

    const hasMore = rows.length > query.take;
    const page = hasMore ? rows.slice(0, query.take) : rows;

    return {
      items: await Promise.all(page.map((row) => this.toLine(row))),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  private async toLine(row: TransactionLineSource) {
    let installment: Record<string, unknown> | undefined;
    if (row.installmentPlan && row.installmentNumber) {
      const remaining = await this.prisma.transaction.aggregate({
        where: {
          installmentPlanId: row.installmentPlanId,
          occurredAt: { gt: new Date() },
        },
        _sum: { amountCents: true },
      });
      installment = {
        number: row.installmentNumber,
        count: row.installmentPlan.installmentsCount,
        remainingBalanceCents: (remaining._sum.amountCents ?? 0n).toString(),
        progress: row.installmentNumber / row.installmentPlan.installmentsCount,
      };
    }

    return {
      id: row.id,
      type: row.type,
      amountCents: row.amountCents.toString(),
      description: row.description,
      occurredAt: row.occurredAt,
      visibility: row.visibility,
      paymentMethod: row.paymentMethod,
      needsDetail: row.needsDetail,
      isFixed: row.recurringAccountId != null,
      category: row.category,
      account: row.account,
      createdBy: row.createdBy,
      commentsCount: row._count.comments,
      installment,
    };
  }

  async detail(spaceId: string, id: string) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, spaceId },
      include: {
        category: true,
        account: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, name: true } },
        installmentPlan: true,
        attachment: true,
        _count: { select: { comments: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado.');

    const line = await this.toLine(row as unknown as TransactionLineSource);
    return {
      ...line,
      owner: row.owner,
      installmentPlan: row.installmentPlan
        ? {
            id: row.installmentPlan.id,
            totalCents: row.installmentPlan.totalCents.toString(),
            installmentsCount: row.installmentPlan.installmentsCount,
            firstDueDate: row.installmentPlan.firstDueDate,
          }
        : null,
      attachment: row.attachment
        ? {
            id: row.attachment.id,
            mime: row.attachment.mime,
            // URL pública montada pelo AttachmentsService (TODO)
          }
        : null,
      comments: row.comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author,
        createdAt: c.createdAt,
      })),
    };
  }

  async update(
    spaceId: string,
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ) {
    const row = await this.prisma.transaction.findFirst({
      where: { id, spaceId },
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado.');
    if (row.installmentPlanId) {
      throw new BadRequestException(
        'Parcelas não podem ser editadas individualmente.',
      );
    }
    if (dto.accountId) await this.assertAccount(spaceId, dto.accountId);
    if (dto.categoryId) await this.assertCategory(spaceId, dto.categoryId);

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        amountCents: dto.amountCents,
        description: dto.description,
        occurredAt: dto.occurredAt,
        accountId: dto.accountId,
        categoryId:
          dto.categoryId === undefined
            ? undefined
            : (dto.categoryId ?? null),
        visibility: dto.visibility,
        ownerId:
          dto.visibility === undefined
            ? undefined
            : dto.visibility === 'PRIVATE'
              ? (row.ownerId ?? userId)
              : null,
        paymentMethod: dto.paymentMethod,
        needsDetail: dto.needsDetail,
        attachmentId:
          dto.attachmentId === undefined
            ? undefined
            : (dto.attachmentId ?? null),
      },
    });

    await this.activity.record({
      spaceId,
      type: ActivityType.TRANSACTION_UPDATED,
      actorId: userId,
      payload: { transactionId: updated.id, text: `editou ${updated.description}` },
    });
    return this.detail(spaceId, id);
  }

  async remove(spaceId: string, id: string): Promise<void> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, spaceId },
      select: { id: true, installmentPlanId: true, transferPairId: true },
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado.');

    if (row.installmentPlanId) {
      await this.prisma.$transaction([
        this.prisma.transaction.deleteMany({
          where: { installmentPlanId: row.installmentPlanId },
        }),
        this.prisma.installmentPlan.delete({
          where: { id: row.installmentPlanId },
        }),
      ]);
      return;
    }

    if (row.transferPairId) {
      await this.prisma.transaction.deleteMany({
        where: { id: { in: [row.id, row.transferPairId] } },
      });
      return;
    }

    await this.prisma.transaction.delete({ where: { id } });
  }
}

interface TransactionLineSource {
  id: string;
  type: TransactionType;
  amountCents: bigint;
  description: string;
  occurredAt: Date;
  visibility: string;
  paymentMethod: string;
  needsDetail: boolean;
  recurringAccountId: string | null;
  installmentPlanId: string | null;
  installmentNumber: number | null;
  installmentPlan: { installmentsCount: number } | null;
  category: unknown;
  account: unknown;
  createdBy: unknown;
  _count: { comments: number };
}
