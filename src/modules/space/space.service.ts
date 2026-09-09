import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, SpaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CATEGORIES } from './default-categories';

const INVITE_TTL_MS = 7 * 86_400_000; // 7 dias

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async create(
    userId: string,
    input: { name?: string; sinceDate?: Date },
  ): Promise<{ id: string }> {
    const already = await this.prisma.spaceMember.findFirst({
      where: { userId },
      select: { spaceId: true },
    });
    if (already) {
      throw new ConflictException('Você já faz parte de um espaço.');
    }

    const space = await this.prisma.space.create({
      data: {
        name: input.name ?? 'Nosso espaço',
        sinceDate: input.sinceDate ?? new Date(),
        members: { create: { userId, role: SpaceRole.OWNER } },
        emergencyFund: { create: {} },
        categories: { create: DEFAULT_CATEGORIES },
      },
      select: { id: true },
    });

    await this.prisma.activityEvent.create({
      data: {
        spaceId: space.id,
        type: ActivityType.MEMBER_JOINED,
        actorId: userId,
        payload: { text: 'criou o espaço' },
      },
    });

    return space;
  }

  async get(spaceId: string) {
    const space = await this.prisma.space.findUniqueOrThrow({
      where: { id: spaceId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    return {
      id: space.id,
      name: space.name,
      sinceDate: space.sinceDate,
      members: space.members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      isComplete: space.members.length >= 2,
    };
  }

  async createInvitation(
    spaceId: string,
    inviterId: string,
    role: SpaceRole,
    email: string,
  ) {
    if (role !== SpaceRole.OWNER) {
      throw new ForbiddenException('Só o dono do espaço pode convidar.');
    }

    const memberCount = await this.prisma.spaceMember.count({
      where: { spaceId },
    });
    if (memberCount >= 2) {
      throw new BadRequestException('O espaço já está completo (2 pessoas).');
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { spaceId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'Já existe um convite pendente. Revogue antes de criar outro.',
      );
    }

    const raw = randomBytes(24).toString('base64url');
    const invitation = await this.prisma.invitation.create({
      data: {
        spaceId,
        inviterId,
        email,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { id: true, email: true, expiresAt: true },
    });

    // TODO: enviar e-mail. Por enquanto o token cru volta na resposta.
    return { ...invitation, token: raw };
  }

  async listInvitations(spaceId: string) {
    return this.prisma.invitation.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvitation(spaceId: string, invitationId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, spaceId },
    });
    if (!invitation) throw new NotFoundException('Convite não encontrado.');
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
  }

  async acceptInvitation(userId: string, rawToken: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new NotFoundException('Convite inválido ou já utilizado.');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Convite expirado.');
    }

    const already = await this.prisma.spaceMember.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (already) {
      throw new ConflictException('Você já faz parte de um espaço.');
    }

    const memberCount = await this.prisma.spaceMember.count({
      where: { spaceId: invitation.spaceId },
    });
    if (memberCount >= 2) {
      throw new BadRequestException('O espaço já está completo.');
    }

    await this.prisma.$transaction([
      this.prisma.spaceMember.create({
        data: {
          spaceId: invitation.spaceId,
          userId,
          role: SpaceRole.MEMBER,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
      this.prisma.activityEvent.create({
        data: {
          spaceId: invitation.spaceId,
          type: ActivityType.MEMBER_JOINED,
          actorId: userId,
          payload: { text: 'entrou no espaço' },
        },
      }),
    ]);

    return { spaceId: invitation.spaceId };
  }
}
