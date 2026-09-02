import { Controller, Get, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, Subscriber } from 'rxjs';
import { Ctx } from '../../common/auth/decorators';
import type { RequestContext } from '../../common/tenancy/request-context';
import { RealtimeService, type RealtimeMessage } from './realtime.service';

/** Um comentário SSE a cada 20s: mantém a conexão viva através do proxy. */
const HEARTBEAT_MS = 20_000;

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Fluxo de eventos da operação (SSE).
   *
   * A conexão fica aberta e o servidor escreve nela quando algo acontece. O
   * painel não pergunta mais "vendeu?" — ele é avisado.
   *
   * O token vai no cabeçalho como em qualquer outra rota: o cliente lê o fluxo
   * com fetch, não com EventSource, justamente para não precisar pendurar
   * credencial na URL, onde ela acabaria em log de proxy.
   */
  @Sse('stream')
  stream(@Ctx() ctx: RequestContext, @Res() response: Response): Observable<{ data: string }> {
    // Proxy que acumula resposta atrasa o evento; estes cabeçalhos desligam isso.
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');

    return new Observable((subscriber: Subscriber<{ data: string }>) => {
      const send = (message: RealtimeMessage) => subscriber.next({ data: JSON.stringify(message) });

      // Primeiro quadro imediato: o painel sabe que está ouvindo de verdade,
      // em vez de ficar num "conectando" que nunca se resolve.
      send({
        event: 'sale.finalized',
        tenantId: ctx.tenantId,
        data: { hello: true },
        at: new Date().toISOString(),
      });

      const unsubscribe = this.realtime.subscribe(ctx.tenantIds, send);
      const heartbeat = setInterval(() => subscriber.next({ data: '{"event":"ping"}' }), HEARTBEAT_MS);

      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    });
  }

  /** Diagnóstico: quantos painéis estão conectados agora. */
  @Get('status')
  status() {
    return { listeners: this.realtime.listeners };
  }
}
