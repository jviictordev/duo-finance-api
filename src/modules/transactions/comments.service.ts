import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, CommentSubjectType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private async assertTransaction(spaceId: string, transactionId: string) {
    const found = await this.prisma.transaction.findFirst({
      where: { id: transactionId, spaceId },
      select: { id: true, description: true },
    });
    if (!found) throw new NotFoundException('Lançamento não encontrado.');
    return found;
  }

  async list(spaceId: string, transactionId: string) {
    await this.assertTransaction(spaceId, transactionId);
    return this.prisma.comment.findMany({
      where: {
        subjectType: CommentSubjectType.TRANSACTION,
        subjectId: transactionId,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async create(
    spaceId: string,
    userId: string,
    transactionId: string,
    body: string,
  ) {
    const transaction = await this.assertTransaction(spaceId, transactionId);
    const comment = await this.prisma.comment.create({
      data: {
        spaceId,
        subjectType: CommentSubjectType.TRANSACTION,
        subjectId: transactionId,
        authorId: userId,
        body,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.activity.record({
      spaceId,
      type: ActivityType.COMMENT_CREATED,
      actorId: userId,
      payload: {
        transactionId,
        commentId: comment.id,
        text: `comentou: ${body.slice(0, 80)}`,
        target: transaction.description,
      },
    });

    return comment;
  }

  async remove(spaceId: string, userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, spaceId },
      select: { id: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado.');
    if (comment.authorId !== userId) {
      throw new NotFoundException('Comentário não encontrado.');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
