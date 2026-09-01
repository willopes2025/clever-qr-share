import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, isRetryable, nextAttemptAt } from './retry-policy';

const agora = new Date('2026-09-14T14:00:00-03:00');

describe('backoff da fila fiscal', () => {
  it('espera pouco na primeira tentativa e muito nas últimas', () => {
    const first = nextAttemptAt(0, agora)!.getTime() - agora.getTime();
    const later = nextAttemptAt(4, agora)!.getTime() - agora.getTime();
    expect(first).toBeGreaterThanOrEqual(5_000);
    expect(later).toBeGreaterThan(first);
  });

  it('para de tentar depois do limite', () => {
    expect(nextAttemptAt(MAX_ATTEMPTS, agora)).toBeNull();
  });
});

describe('classificação da rejeição', () => {
  it('reenvia sozinho quando a SEFAZ está indisponível', () => {
    expect(isRetryable('108')).toBe(true);
    expect(isRetryable('539')).toBe(true);
  });

  it('manda para correção humana quando o cadastro está errado', () => {
    expect(isRetryable('778')).toBe(false); // NCM inválido
  });
});
