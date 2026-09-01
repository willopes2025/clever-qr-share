/**
 * Conversa com a impressora e a gaveta através do SM Bridge, o agente que roda
 * no computador do quiosque. O navegador não manda ESC/POS nem abre gaveta,
 * então tudo passa por ele — e, se ele não responder, a venda continua.
 */
/**
 * O agente escuta em HTTP no próprio computador. Navegador trata `localhost`
 * como origem segura, então a página em HTTPS consegue falar com ele sem
 * certificado autoassinado — que seria um problema de instalação em cada loja.
 */
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? 'http://127.0.0.1:9123';
const TIMEOUT_MS = 1500;

export interface BridgeStatus {
  printerOk: boolean | null;
  version: string | null;
}

async function bridge<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BRIDGE_URL}${path}`, { ...init, signal: controller.signal });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    // Bridge fora do ar não pode virar erro na tela do caixa.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function bridgeStatus(): Promise<BridgeStatus | null> {
  return bridge<BridgeStatus>('/health');
}

export interface ReceiptPayload {
  store: string;
  cnpj: string;
  terminal: string;
  operator: string;
  occurredAt: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  totalCents: number;
  discountCents?: number;
  payments: Array<{
    method: string;
    amountCents: number;
    changeCents?: number;
    cardBrand?: string;
  }>;
  customerDocument?: string;
}

export function printReceipt(receipt: ReceiptPayload): Promise<unknown> {
  return bridge('/print/receipt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(receipt),
  });
}

export function openDrawer(): Promise<unknown> {
  return bridge('/drawer/open', { method: 'POST' });
}

export interface CashClosingPayload {
  store: string;
  terminal: string;
  operator: string;
  openedAt: string;
  closedAt: string;
  openingFloatCents: number;
  salesCount: number;
  movements: Array<{ kind: string; amountCents: number; reason: string }>;
  expected: Record<string, number>;
  counted: Record<string, number>;
  differenceByMethod: Record<string, number>;
  differenceCents: number;
  notes?: string;
}

export function printCashClosing(report: CashClosingPayload): Promise<unknown> {
  return bridge('/print/cash-closing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
}
