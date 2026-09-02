import { session } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/v1';
/** Recomeço com espera crescente: queda de rede não vira martelada no servidor. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export interface RealtimeMessage {
  event: string;
  tenantId?: string;
  data?: Record<string, unknown>;
  at?: string;
}

/**
 * Ouve os eventos da operação.
 *
 * Lê o fluxo SSE com fetch em vez de EventSource porque assim o token viaja no
 * cabeçalho, como no resto do sistema — EventSource obrigaria a pendurá-lo na
 * URL, onde ele acabaria gravado em log de proxy.
 *
 * Devolve a função que encerra a escuta. Reconecta sozinho: o painel fica aberto
 * o dia inteiro na loja, e queda de Wi-Fi não pode exigir F5 de ninguém.
 */
export function listenToOperation(
  onMessage: (message: RealtimeMessage) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const controller = new AbortController();
  let attempt = 0;
  let stopped = false;

  async function connect(): Promise<void> {
    const token = session.read();
    if (!token || stopped) return;

    try {
      const response = await fetch(`${BASE_URL}/realtime/stream`, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);

      onStatus?.(true);
      attempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Quadro SSE termina em linha em branco; o resto fica para o próximo pedaço.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const payload = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('');
          if (!payload) continue;
          try {
            onMessage(JSON.parse(payload) as RealtimeMessage);
          } catch {
            // Quadro truncado não derruba a escuta.
          }
        }
      }
    } catch {
      // Silêncio de propósito: a queda é esperada e o retorno é automático.
    }

    onStatus?.(false);
    if (stopped) return;

    const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];
    attempt += 1;
    setTimeout(connect, wait);
  }

  void connect();

  return () => {
    stopped = true;
    controller.abort();
  };
}
