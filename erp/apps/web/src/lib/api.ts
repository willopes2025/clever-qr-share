const BASE_URL = import.meta.env.VITE_API_URL ?? '/v1';
const TOKEN_KEY = 'soul.web.token';

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const session = {
  read: (): string | null => localStorage.getItem(TOKEN_KEY),
  write: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = session.read();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) session.clear();
    const error = payload?.error ?? {};
    throw new ApiError(error.code ?? 'UNKNOWN', error.message ?? 'Falha na requisição', response.status);
  }
  return payload as T;
}

export interface LivePerformance {
  date: string;
  revenueCents: number;
  salesCount: number;
  avgTicketCents: number;
  byStore: Array<{
    storeId: string;
    storeName: string;
    revenueCents: number;
    salesCount: number;
    avgTicketCents: number;
  }>;
  comparedToLastWeek: { revenueCents: number; variationPercent: number | null };
}

export interface HourSlot {
  /** Faixa do dia no formato "HH:MM". */
  slot: string;
  salesCount: number;
  revenueCents: number;
  days: number;
  avgRevenueCents: number;
}

export interface MixEntry {
  skuId: string;
  description: string;
  quantity: number;
  revenueCents: number;
  sharePercent: number;
}

export interface TerminalHealth {
  id: string;
  code: string;
  store: string;
  online: boolean;
  lastSeenAt: string | null;
  minutesSinceSeen: number | null;
  appVersion: string | null;
  pendingSales: number;
  fiscalQueue: number;
  printerOk: boolean | null;
  openAlerts: Array<{ kind: string; severity: string; openedAt: string }>;
}

// ---------------------------------------------------------------- retaguarda

export interface ProductSku {
  id?: string;
  code: string;
  description: string;
  priceCents: number | null;
  barcode: string | null;
  active?: boolean;
}

export interface Product {
  id: string;
  name: string;
  categoryName: string | null;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  origin: number;
  active: boolean;
  skus: ProductSku[];
}

export interface Terminal {
  id: string;
  code: string;
  fiscalSeries: number;
  status: string;
  appVersion: string | null;
  lastSeenAt: string | null;
  paired: boolean;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  kind: string;
  opensAt: string | null;
  closesAt: string | null;
  active: boolean;
  salesCount: number;
  terminals: Terminal[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  hasPin: boolean;
  hasPassword: boolean;
  roles: Array<{ code: string; name: string; storeId: string | null }>;
}

export interface StockBalance {
  skuId: string;
  code: string;
  description: string;
  quantity: number;
  minStock: number;
  avgCostCents: number;
  belowMinimum: boolean;
  negative: boolean;
  nextExpiry: string | null;
}

export interface StockMovement {
  id: string;
  kind: string;
  quantity: number;
  unitCostCents: number;
  reason: string | null;
  lotCode: string | null;
  occurredAt: string;
}

export interface CountDifference {
  skuId: string;
  description: string;
  expected: number;
  counted: number;
  difference: number;
}

export interface SaleRow {
  id: string;
  number: number;
  storeName: string;
  terminalCode: string | null;
  status: string;
  totalCents: number;
  occurredAt: string;
  methods: string[];
  fiscal: { status: string; number: number | null; accessKey: string | null } | null;
}

export interface SaleDetail {
  id: string;
  number: number;
  status: string;
  storeName: string;
  terminalCode: string | null;
  operatorName: string | null;
  customerDocument: string | null;
  occurredAt: string;
  grossCents: number;
  discountCents: number;
  totalCents: number;
  items: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    discountCents: number;
    totalCents: number;
  }>;
  payments: Array<{
    method: string;
    amountCents: number;
    changeCents: number;
    cardBrand: string | null;
    installments: number;
  }>;
  fiscal: {
    id: string;
    status: string;
    number: number | null;
    accessKey: string | null;
    qrCode: string | null;
    danfeUrl: string | null;
    rejectionMsg: string | null;
  } | null;
}
