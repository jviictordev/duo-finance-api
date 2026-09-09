import {
  Controller,
  MessageEvent,
  NotImplementedException,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable } from 'rxjs';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { DomainEventsService } from './domain-events.service';

@ApiTags('realtime')
@Controller('stream')
export class RealtimeController {
  constructor(
    private readonly events: DomainEventsService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Sse()
  @ApiOperation({
    summary:
      'SSE de eventos do espaço. Auth via ?token= (obtido em POST /api/auth/stream-token).',
  })
  async stream(@Query('token') token: string): Promise<Observable<MessageEvent>> {
    // Serverless (Vercel/Lambda) não sustenta conexão longa nem tem memória
    // compartilhada entre invocações — o front deve usar polling em /activity.
    if (process.env.VERCEL || process.env.SSE_DISABLED === 'true') {
      throw new NotImplementedException(
        'SSE indisponível neste ambiente. Use polling em GET /api/activity.',
      );
    }

    const { sub } = await this.tokens.verifyStreamToken(token);
    const membership = await this.prisma.spaceMember.findFirstOrThrow({
      where: { userId: sub },
      select: { spaceId: true },
    });

    const heartbeat = interval(25_000).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
    );

    const domain = this.events.forSpace(membership.spaceId).pipe(
      map(
        (event): MessageEvent => ({
          type: event.type,
          data: { payload: event.payload, at: event.at },
        }),
      ),
    );

    return merge(domain, heartbeat);
  }
}
