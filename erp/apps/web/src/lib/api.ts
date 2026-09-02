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
