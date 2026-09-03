import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DomainEventBus, type DomainEventMap } from '../../common/events/domain-events';

export interface RealtimeMessage {
  event: keyof DomainEventMap;
  tenantId: string;
  data: Record<string, unknown>;
  at: string;
}

type Subscriber = (message: RealtimeMessage) => void;

/**
 * Empurra o que acontece na operação para quem está com o painel aberto.
 *
 * Antes disso o painel perguntava de trinta em trinta segundos, e a venda podia
 * levar meio minuto para aparecer — tempo suficiente para o dono achar que o
 * caixa não registrou. Agora a venda gravada avisa o painel na hora.
 *
 * A assinatura é por tenant: um cliente só recebe o que é da própria empresa,
 * e quem tem grupo econômico assina os CNPJs que o token já autoriza.
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  constructor(private readonly events: DomainEventBus) {}

  onModuleInit(): void {
    this.relay('sale.finalized', (payload) => ({
      saleId: payload.saleId,
      storeId: payload.storeId,
      terminalId: payload.terminalId,
      totalCents: Number(payload.totalCents),
      occurredAt: payload.occurredAt.toISOString(),
    }));
    // Cancelamento muda faturamento e estoque: o painel precisa saber na hora.
    this.relay('sale.cancelled', (payload) => ({
      saleId: payload.saleId,
      storeId: payload.storeId,
      reason: payload.reason,
    }));
    this.relay('cash.session.closed', (payload) => ({
      sessionId: payload.sessionId,
      differenceCents: Number(payload.differenceCents),
    }));
    this.relay('fiscal.document.authorized', (payload) => ({
      documentId: payload.documentId,
      saleId: payload.saleId,
    }));
    this.relay('fiscal.document.rejected', (payload) => ({
      documentId: payload.documentId,
      code: payload.code,
      message: payload.message,
    }));
    this.relay('fiscal.document.cancelled', (payload) => ({ documentId: payload.documentId }));
  }

  subscribe(tenantIds: string[], subscriber: Subscriber): () => void {
    for (const tenantId of tenantIds) {
      const set = this.subscribers.get(tenantId) ?? new Set();
      set.add(subscriber);
      this.subscribers.set(tenantId, set);
    }

    return () => {
      for (const tenantId of tenantIds) {
        const set = this.subscribers.get(tenantId);
        if (!set) continue;
        set.delete(subscriber);
        if (set.size === 0) this.subscribers.delete(tenantId);
      }
    };
  }

  /** Quantos painéis estão ouvindo. Serve ao diagnóstico, não à regra. */
  get listeners(): number {
    return new Set([...this.subscribers.values()].flatMap((set) => [...set])).size;
  }

  private relay<K extends keyof DomainEventMap>(
    event: K,
    toData: (payload: DomainEventMap[K]) => Record<string, unknown>,
  ): void {
    this.events.on(event, (payload) => {
      this.publish({
        event,
        tenantId: payload.tenantId,
        data: toData(payload),
        at: new Date().toISOString(),
      });
    });
  }

  private publish(message: RealtimeMessage): void {
    const set = this.subscribers.get(message.tenantId);
    if (!set?.size) return;

    for (const subscriber of set) {
      try {
        subscriber(message);
      } catch (error) {
        // Um painel com problema não pode atrapalhar os outros nem a venda.
        this.logger.warn(`Falha ao entregar ${message.event}: ${(error as Error).message}`);
      }
    }
  }
}
