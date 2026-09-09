import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

/**
 * Resolve o espaço do usuário (uma dupla = um espaço) e o anexa em `request.space`.
 * Usar em rotas que operam sobre dados do espaço. Requer JwtAuthGuard antes.
 */
@Injectable()
export class SpaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user: AuthUser; space?: unknown }>();

    const membership = await this.prisma.spaceMember.findFirst({
      where: { userId: request.user.id },
      orderBy: { joinedAt: 'asc' },
      select: { spaceId: true, role: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Você ainda não faz parte de um espaço. Crie um em POST /space.',
      );
    }

    request.space = { id: membership.spaceId, role: membership.role };
    return true;
  }
}
