import Dexie, { type Table } from 'dexie';
import type { SaleInput } from '@soul/contracts';

/**
 * Banco local do PDV.
 *
 * É o que sustenta o modo offline: catálogo replicado para vender sem internet
 * e fila de saída para nada se perder quando a rede volta.
 */
export interface CachedCatalogItem {
  skuId: string;
  code: string;
  description: string;
  categoryName: string | null;
  unit: string;
  priceCents: number;
  barcodes: string[];
}

export type OutboxStatus = 'pending' | 'sending' | 'quarantined';

export interface OutboxEntry {
  saleId: string;
  sale: SaleInput;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  queuedAt: string;
}

/**
 * Cupom guardado para reimpressão.
 *
 * Fica no próprio terminal, não no servidor: impressora travada é problema
 * local, e acontece exatamente quando a rede também caiu. Reimprimir não pode
 * depender de estar online.
 */
export interface RecentSale {
  saleId: string;
  number: number | null;
  totalCents: number;
  itemCount: number;
  operatorName: string | null;
  occurredAt: string;
  /** O cupom pronto, como foi impresso da primeira vez. */
  receipt: unknown;
}

export interface LocalSetting {
  key: string;
  value: unknown;
}

class PdvDatabase extends Dexie {
  catalog!: Table<CachedCatalogItem, string>;
  outbox!: Table<OutboxEntry, string>;
  settings!: Table<LocalSetting, string>;
  recentSales!: Table<RecentSale, string>;

  constructor() {
    super('soul-pdv');
    this.version(1).stores({
      catalog: 'skuId, code, description, *barcodes',
      outbox: 'saleId, status, queuedAt',
      settings: 'key',
    });
    // Versão 2 acrescenta os cupons para reimpressão. Dexie migra sozinho, sem
    // apagar o que já está no terminal — e o que está lá é venda de verdade.
    this.version(2).stores({
      recentSales: 'saleId, occurredAt',
    });
  }
}

export const db = new PdvDatabase();

export async function readSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function replaceCatalog(items: CachedCatalogItem[]): Promise<void> {
  await db.transaction('rw', db.catalog, async () => {
    await db.catalog.clear();
    await db.catalog.bulkPut(items);
  });
}

export async function countPending(): Promise<number> {
  return db.outbox.where('status').anyOf('pending', 'sending').count();
}

/**
 * Vendas que o servidor recusou por regra de negócio e que não voltam sozinhas.
 *
 * Precisam de olho humano: sem isso a venda some da fila sem ninguém saber, o
 * turno fecha achando que está tudo certo, e o dinheiro na gaveta não bate com
 * o sistema no dia seguinte.
 */
export async function countQuarantined(): Promise<number> {
  return db.outbox.where('status').equals('quarantined').count();
}

/** Detalhe das recusadas, para a tela dizer o motivo em vez de só contar. */
export async function listQuarantined(): Promise<
  Array<{ saleId: string; lastError?: string; queuedAt: string }>
> {
  const entries = await db.outbox.where('status').equals('quarantined').toArray();
  return entries.map((entry) => ({
    saleId: entry.saleId,
    lastError: entry.lastError,
    queuedAt: entry.queuedAt,
  }));
}

/** Quantos cupons ficam guardados. Um turno de quiosque cabe folgado. */
const RECENT_SALES_LIMIT = 200;

export async function rememberSale(sale: RecentSale): Promise<void> {
  await db.recentSales.put(sale);

  // Poda os mais antigos: o terminal do quiosque não é arquivo morto.
  const total = await db.recentSales.count();
  if (total <= RECENT_SALES_LIMIT) return;

  const excedente = await db.recentSales
    .orderBy('occurredAt')
    .limit(total - RECENT_SALES_LIMIT)
    .primaryKeys();
  await db.recentSales.bulkDelete(excedente);
}

export async function listRecentSales(limit = 30): Promise<RecentSale[]> {
  return db.recentSales.orderBy('occurredAt').reverse().limit(limit).toArray();
}
