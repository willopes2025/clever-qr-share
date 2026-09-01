/**
 * Conversa com a balança e a impressora através do SM Bridge, o agente que roda
 * no computador do quiosque. O navegador não abre porta serial nem manda ESC/POS,
 * então tudo passa por ele — e, se ele não responder, a venda continua.
 */
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? 'https://localhost:9123';
const TIMEOUT_MS = 1500;

export interface ScaleReading {
  weightKg: number;
  stable: boolean;
}

export interface BridgeStatus {
  printerOk: boolean | null;
  scaleOk: boolean | null;
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

export function readScale(): Promise<ScaleReading | null> {
  return bridge<ScaleReading>('/scale/read');
}

export function bridgeStatus(): Promise<BridgeStatus | null> {
  return bridge<BridgeStatus>('/health');
}

export function printReceipt(payload: unknown): Promise<unknown> {
  return bridge('/print/receipt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function openDrawer(): Promise<unknown> {
  return bridge('/drawer/open', { method: 'POST' });
}
