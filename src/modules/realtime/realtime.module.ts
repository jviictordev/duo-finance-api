import { Global, Module } from '@nestjs/common';
import { DomainEventsService } from './domain-events.service';
import { RealtimeController } from './realtime.controller';

// TODO(escala): para >1 instância no VPS, ligar DomainEventsService ao Redis
// (REDIS_URL) via pub/sub para propagar eventos entre processos.
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [DomainEventsService],
  exports: [DomainEventsService],
})
export class RealtimeModule {}
