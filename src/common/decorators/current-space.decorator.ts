import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SpaceRole } from '@prisma/client';

export interface SpaceContext {
  id: string;
  role: SpaceRole;
}

/**
 * Devolve o espaço da sessão (resolvido pelo SpaceGuard).
 * Lança 403 se o usuário ainda não tem espaço — rotas que dependem de espaço
 * devem usar o SpaceGuard.
 */
export const CurrentSpace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SpaceContext => {
    const request = ctx.switchToHttp().getRequest<{ space?: SpaceContext }>();
    if (!request.space) {
      throw new ForbiddenException('Nenhum espaço associado a este usuário.');
    }
    return request.space;
  },
);
