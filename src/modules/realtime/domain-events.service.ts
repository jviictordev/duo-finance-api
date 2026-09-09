import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';

export interface DomainEvent {
  spaceId: string;
  type: string; // ex.: "transaction.created", "fund.contribution", "month.closed"
  payload: unknown;
  at: string;
}

/**
 * Barramento de eventos em processo. O SSE assina por espaço.
 * Para múltiplas instâncias no VPS: publicar/assinar também no Redis
 * (REDIS_URL) — ver TODO em RealtimeModule.
 */
@Injectable()
export class DomainEventsService {
  private readonly stream = new Subject<DomainEvent>();

  emit(spaceId: string, type: string, payload: unknown): void {
    this.stream.next({ spaceId, type, payload, at: new Date().toISOString() });
  }

  forSpace(spaceId: string): Observable<DomainEvent> {
    return this.stream.pipe(
      filter((event) => event.spaceId === spaceId),
      map((event) => event),
    );
  }
}
