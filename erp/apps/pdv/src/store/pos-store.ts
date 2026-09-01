import { create } from 'zustand';
import type { SaleInput, SalePaymentInput } from '@soul/contracts';
import { request } from '../lib/api';
import {
  countPending,
  db,
  readSetting,
  replaceCatalog,
  writeSetting,
  type CachedCatalogItem,
} from '../lib/db';
import { Outbox } from '../lib/outbox';
import { buildLine, cartTotal, renumber, type CartLine } from '../lib/cart';
import { bridgeStatus } from '../lib/scale';

interface Bootstrap {
  tenant: { id: string; tradeName: string; cnpj: string };
  store: { id: string; name: string; code: string };
  terminal: { id: string; code: string; fiscalSeries: number };
  operators: Array<{ id: string; name: string }>;
  catalog: CachedCatalogItem[];
  features: string[];
  openSession: { id: string; openedAt: string; openingFloatCents: number } | null;
}

interface PosState {
  token: string | null;
  bootstrap: Bootstrap | null;
  catalog: CachedCatalogItem[];
  operator: { id: string; name: string } | null;
  sessionId: string | null;
  cart: CartLine[];
  pendingCount: number;
  online: boolean;
  devices: { printerOk: boolean | null; scaleOk: boolean | null };
  lastSaleAt: string | null;
  booting: boolean;
  error: string | null;

  pairTerminal: (deviceToken: string) => Promise<void>;
  restore: () => Promise<void>;
  selectOperator: (operator: { id: string; name: string }) => void;
  openCashSession: (openingFloatCents: number) => Promise<void>;
  addItem: (item: CachedCatalogItem, quantity: number, options?: { weighed?: boolean; overrideTotalCents?: number }) => void;
  removeLine: (lineNumber: number) => void;
  clearCart: () => void;
  finalizeSale: (payments: SalePaymentInput[], customerDocument?: string) => Promise<SaleInput>;
  refreshStatus: () => Promise<void>;
}

const TOKEN_KEY = 'terminal.token';
const OPERATOR_KEY = 'terminal.operator';

let outbox: Outbox | null = null;

export const usePos = create<PosState>((set, get) => ({
  token: null,
  bootstrap: null,
  catalog: [],
  operator: null,
  sessionId: null,
  cart: [],
  pendingCount: 0,
  online: navigator.onLine,
  devices: { printerOk: null, scaleOk: null },
  lastSaleAt: null,
  booting: true,
  error: null,

  async pairTerminal(deviceToken) {
    const auth = await request<{ accessToken: string }>('/auth/terminal', {
      method: 'POST',
      body: { deviceToken },
    });
    await writeSetting(TOKEN_KEY, auth.accessToken);
    set({ token: auth.accessToken });
    await get().restore();
  },

  /**
   * Sobe o PDV. Com internet, baixa o pacote do servidor e atualiza o cache;
   * sem internet, sobe com o catálogo que já está no disco — é o que permite
   * abrir o caixa mesmo com a rede caída.
   */
  async restore() {
    set({ booting: true, error: null });
    const token = get().token ?? (await readSetting<string>(TOKEN_KEY)) ?? null;
    const operator = (await readSetting<{ id: string; name: string }>(OPERATOR_KEY)) ?? null;

    if (!token) {
      set({ booting: false, token: null });
      return;
    }

    try {
      const bootstrap = await request<Bootstrap>('/pos/bootstrap', { token });
      await replaceCatalog(bootstrap.catalog);
      await writeSetting('bootstrap', bootstrap);
      set({
        token,
        bootstrap,
        catalog: bootstrap.catalog,
        operator,
        sessionId: bootstrap.openSession?.id ?? null,
        online: true,
      });
    } catch {
      // Offline: reaproveita o que está no banco local.
      const cached = await readSetting<Bootstrap>('bootstrap');
      const catalog = await db.catalog.toArray();
      set({
        token,
        bootstrap: cached ?? null,
        catalog,
        operator,
        sessionId: cached?.openSession?.id ?? null,
        online: false,
      });
    }

    if (!outbox) {
      outbox = new Outbox(
        () => get().token,
        () => get().bootstrap?.terminal.id ?? null,
        () => void get().refreshStatus(),
      );
      outbox.start();
    }

    set({ booting: false, pendingCount: await countPending() });
    void get().refreshStatus();
  },

  selectOperator(operator) {
    void writeSetting(OPERATOR_KEY, operator);
    set({ operator });
  },

  async openCashSession(openingFloatCents) {
    const { token, bootstrap, operator } = get();
    if (!token || !bootstrap || !operator) throw new Error('Terminal não inicializado');

    const session = await request<{ id: string }>(`/pos/cash-sessions?operatorId=${operator.id}`, {
      method: 'POST',
      token,
      body: { terminalId: bootstrap.terminal.id, openingFloatCents },
    });
    set({ sessionId: session.id });
  },

  addItem(item, quantity, options) {
    const cart = get().cart;
    set({ cart: [...cart, buildLine(item, quantity, cart.length + 1, options)] });
  },

  removeLine(lineNumber) {
    set({ cart: renumber(get().cart.filter((line) => line.lineNumber !== lineNumber)) });
  },

  clearCart() {
    set({ cart: [] });
  },

  /**
   * Fecha a venda localmente e devolve o controle ao caixa na hora.
   * O envio ao servidor e a nota fiscal acontecem depois, em segundo plano.
   */
  async finalizeSale(payments, customerDocument) {
    const { cart, operator, sessionId } = get();
    if (!operator) throw new Error('Selecione o operador');
    if (!sessionId) throw new Error('Abra o caixa antes de vender');
    if (cart.length === 0) throw new Error('Carrinho vazio');

    const total = cartTotal(cart);
    const sale: SaleInput = {
      id: crypto.randomUUID(),
      sessionId,
      operatorId: operator.id,
      customerDocument,
      channel: 'pos',
      occurredAt: withOffset(new Date()),
      items: cart.map((line) => ({
        lineNumber: line.lineNumber,
        skuId: line.skuId,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unit: line.unit as 'UN' | 'KG' | 'L',
        unitPriceCents: line.unitPriceCents,
        discountCents: line.discountCents,
        totalCents: line.totalCents,
        weighed: line.weighed,
      })),
      payments,
      grossCents: total,
      discountCents: 0,
      totalCents: total,
      clientVersion: __APP_VERSION__,
    };

    await outbox?.enqueue(sale);
    set({ cart: [], lastSaleAt: sale.occurredAt, pendingCount: await countPending() });
    return sale;
  },

  async refreshStatus() {
    const status = await bridgeStatus();
    set({
      pendingCount: await countPending(),
      online: navigator.onLine,
      devices: { printerOk: status?.printerOk ?? null, scaleOk: status?.scaleOk ?? null },
    });
  },
}));

/** ISO com o fuso local, porque o servidor precisa saber a hora real do quiosque. */
function withOffset(date: Date): string {
  const pad = (value: number) => String(Math.floor(Math.abs(value))).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    date.toISOString().slice(0, -1).split('.')[0] +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}
