import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEventsService } from '../realtime/domain-events.service';

const DOMAIN_EVENT_NAME: Record<ActivityType, string> = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  COMMENT_CREATED: 'comment.created',
  FUND_CONTRIBUTION: 'fund.contribution',
  FUND_WITHDRAWAL: 'fund.withdrawal',
  MONTH_CLOSED: 'month.closed',
  MEMBER_JOINED: 'member.joined',
};

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
  ) {}

  /**
   * Registra um evento no feed (append-only) e propaga via SSE.
   * Aceita um client transacional para participar de uma $transaction.
   */
  async record(
    input: {
      spaceId: string;
      type: ActivityType;
      actorId?: string;
      payload: Prisma.InputJsonValue;
    },
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await tx.activityEvent.create({
      data: {
        spaceId: input.spaceId,
        type: input.type,
        actorId: input.actorId,
        payload: input.payload,
      },
    });
    this.events.emit(
      input.spaceId,
      DOMAIN_EVENT_NAME[input.type],
      input.payload,
    );
  }

  async feed(spaceId: string, cursor?: string, take = 30) {
    const rows = await this.prisma.activityEvent.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map((row) => ({
        id: row.id,
        type: row.type,
        actor: row.actor,
        payload: row.payload,
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }
}
