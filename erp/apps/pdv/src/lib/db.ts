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

export interface LocalSetting {
  key: string;
  value: unknown;
}

class PdvDatabase extends Dexie {
  catalog!: Table<CachedCatalogItem, string>;
  outbox!: Table<OutboxEntry, string>;
  settings!: Table<LocalSetting, string>;

  constructor() {
    super('soul-pdv');
    this.version(1).stores({
      catalog: 'skuId, code, description, *barcodes',
      outbox: 'saleId, status, queuedAt',
      settings: 'key',
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
