import { Injectable, Logger } from '@nestjs/common';

export interface SaleFinalizedEvent {
  tenantId: string;
  storeId: string;
  terminalId: string;
  saleId: string;
  totalCents: bigint;
  occurredAt: Date;
}

export interface DomainEventMap {
  'sale.finalized': SaleFinalizedEvent;
  'cash.session.closed': { tenantId: string; sessionId: string; differenceCents: bigint };
  'fiscal.document.authorized': { tenantId: string; documentId: string; saleId: string | null };
  'fiscal.document.rejected': { tenantId: string; documentId: string; code: string; message: string };
}

type Handler<K extends keyof DomainEventMap> = (payload: DomainEventMap[K]) => void | Promise<void>;

/**
 * Barramento em processo. A fronteira entre módulos é o evento, não o repositório
 * do vizinho — trocar por fila externa depois é trocar o publisher, não os módulos.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, Handler<never>[]>();

  on<K extends keyof DomainEventMap>(event: K, handler: Handler<K>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(event, list);
  }

  async emit<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) {
      try {
        await (handler as Handler<K>)(payload);
      } catch (error) {
        // Um assinante que falha não derruba a venda que já foi gravada.
        this.logger.error(`Falha ao tratar ${event}: ${(error as Error).message}`, (error as Error).stack);
      }
    }
  }
}
