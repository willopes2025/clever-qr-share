/**
 * Cores de dado do painel.
 *
 * Roxo é a série principal; magenta entra só quando há uma segunda série. O par
 * foi verificado para daltonismo e contraste sobre o fundo claro — rosa da marca
 * fica de fora dos gráficos porque não alcança contraste suficiente como marca.
 */
export const DATA_SERIES = ['#6147DE', '#D6338F'] as const;

export const STATUS_COLORS = {
  good: '#0E8F5E',
  warning: '#B4700A',
  critical: '#C42B34',
} as const;

export type StatusTone = keyof typeof STATUS_COLORS;

/** Escala linear simples: evita dependência de biblioteca para gráficos pequenos. */
export function scale(value: number, max: number, size: number): number {
  if (max <= 0) return 0;
  return (value / max) * size;
}

export function niceMax(values: readonly number[]): number {
  const max = Math.max(0, ...values);
  if (max === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}
