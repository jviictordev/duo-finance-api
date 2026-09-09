import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(spaceId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'asc' },
    });

    // saldo atual = saldo inicial + entradas - saídas (transferências entram no par)
    const sums = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { spaceId },
      _sum: { amountCents: true },
    });

    return accounts.map((acc) => {
      let balance = acc.openingBalanceCents;
      for (const row of sums) {
        if (row.accountId !== acc.id) continue;
        const value = row._sum.amountCents ?? 0n;
        balance +=
          row.type === TransactionType.INCOME ? value : -value;
      }
      return { ...acc, currentBalanceCents: balance };
    });
  }

  async create(spaceId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        spaceId,
        name: dto.name,
        kind: dto.kind,
        openingBalanceCents: dto.openingBalanceCents,
        color: dto.color,
      },
    });
  }

  async update(spaceId: string, id: string, dto: UpdateAccountDto) {
    await this.ensureOwned(spaceId, id);
    return this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name,
        kind: dto.kind,
        color: dto.color === null ? null : dto.color,
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? new Date()
              : null,
      },
    });
  }

  async remove(spaceId: string, id: string): Promise<void> {
    await this.ensureOwned(spaceId, id);
    const used = await this.prisma.transaction.count({
      where: { accountId: id },
    });
    if (used > 0) {
      // não apaga conta com histórico — só arquiva
      await this.prisma.account.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return;
    }
    await this.prisma.account.delete({ where: { id } });
  }

  private async ensureOwned(spaceId: string, id: string): Promise<void> {
    const found = await this.prisma.account.findFirst({
      where: { id, spaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Conta não encontrada.');
  }
}
