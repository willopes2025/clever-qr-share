import type { SaleInput, SyncSalesResponse } from '@soul/contracts';
import { ApiError, NetworkError, request } from './api';
import { db, type OutboxEntry } from './db';

const BATCH_SIZE = 50;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;

/**
 * Fila de saída do PDV.
 *
 * Regras que sustentam a promessa de não perder nem duplicar venda:
 *  - a venda só sai da fila depois que o servidor confirma;
 *  - o id vem do PDV, então reenviar o mesmo lote é inofensivo;
 *  - erro de negócio vai para quarentena em vez de repetir para sempre.
 */
export class Outbox {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private running = false;

  constructor(
    private readonly getToken: () => string | null,
    private readonly getTerminalId: () => string | null,
    private readonly onChange: () => void,
  ) {}

  async enqueue(sale: SaleInput): Promise<void> {
    const entry: OutboxEntry = {
      saleId: sale.id,
      sale,
      status: 'pending',
      attempts: 0,
      queuedAt: new Date().toISOString(),
    };
    await db.outbox.put(entry);
    this.onChange();
    void this.flush();
  }

  start(): void {
    void this.flush();
    window.addEventListener('online', this.handleOnline);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener('online', this.handleOnline);
  }

  private handleOnline = (): void => {
    this.consecutiveFailures = 0;
    void this.flush();
  };

  async flush(): Promise<void> {
    if (this.running) return;
    const token = this.getToken();
    const terminalId = this.getTerminalId();
    if (!token || !terminalId) return;

    const pending = await db.outbox.where('status').equals('pending').limit(BATCH_SIZE).toArray();
    if (pending.length === 0) return;

    this.running = true;
    try {
      const response = await request<SyncSalesResponse>('/sync/sales', {
        method: 'POST',
        token,
        body: { terminalId, sales: pending.map((entry) => entry.sale) },
      });
      await this.applyResponse(response);
      this.consecutiveFailures = 0;
      this.schedule(BASE_DELAY_MS);
    } catch (error) {
      await this.registerFailure(pending, error);
      this.consecutiveFailures += 1;
      this.schedule(this.backoffDelay());
    } finally {
      this.running = false;
      this.onChange();
    }
  }

  private async applyResponse(response: SyncSalesResponse): Promise<void> {
    const accepted = response.results.map((result) => result.id);
    if (accepted.length > 0) await db.outbox.bulkDelete(accepted);

    for (const rejection of response.rejected) {
      if (rejection.action === 'discard') {
        await db.outbox.delete(rejection.id);
        continue;
      }
      await db.outbox.update(rejection.id, {
        // Erro de negócio não se resolve tentando de novo: sai da fila e vira pendência.
        status: rejection.action === 'quarantine' ? 'quarantined' : 'pending',
        lastError: `${rejection.code}: ${rejection.message}`,
      });
    }
  }

  private async registerFailure(entries: OutboxEntry[], error: unknown): Promise<void> {
    const message =
      error instanceof NetworkError
        ? 'sem conexão'
        : error instanceof ApiError
          ? `${error.code}: ${error.message}`
          : 'falha inesperada';

    await Promise.all(
      entries.map((entry) =>
        db.outbox.update(entry.saleId, { attempts: entry.attempts + 1, lastError: message }),
      ),
    );
  }

  private backoffDelay(): number {
    const delay = BASE_DELAY_MS * 2 ** Math.min(this.consecutiveFailures, 6);
    const jitter = Math.random() * 0.2 * delay;
    return Math.min(delay + jitter, MAX_DELAY_MS);
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delayMs);
  }
}
