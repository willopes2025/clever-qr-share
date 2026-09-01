/**
 * Retentativa da fila fiscal.
 *
 * O caixa nunca espera a nota: se a SEFAZ ou o gateway estiverem fora, o
 * documento volta para a fila com espera crescente em vez de virar erro na tela.
 */
const BACKOFF_STEPS_MS = [
  5_000,      // 5s
  30_000,     // 30s
  120_000,    // 2min
  600_000,    // 10min
  3_600_000,  // 1h
];

export const MAX_ATTEMPTS = 12;

export function nextAttemptAt(attempts: number, now = new Date()): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const step = BACKOFF_STEPS_MS[Math.min(attempts, BACKOFF_STEPS_MS.length - 1)]!;
  // Jitter evita que todos os terminais tentem no mesmo instante depois de uma queda.
  const jitter = Math.floor(Math.random() * (step * 0.2));
  return new Date(now.getTime() + step + jitter);
}

/**
 * Rejeição transitória volta para a fila sozinha; a definitiva vai para a tela
 * de correção, porque exige alguém arrumar cadastro.
 */
export function isRetryable(rejectionCode: string): boolean {
  const transient = ['108', '109', '110', '999', 'TIMEOUT', 'NETWORK'];
  return transient.includes(rejectionCode) || rejectionCode.startsWith('5');
}
