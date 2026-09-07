/**
 * Há quanto tempo a fila espera, e a partir de quando isso vira problema.
 *
 * São margens operacionais, não prazos legais: a janela exata da SEFAZ varia
 * por estado e não sai publicada de forma aproveitável. O que se mediu neste
 * cliente é que uma venda de 45 minutos já volta recusada por atraso — então o
 * aviso precisa aparecer bem antes disso, enquanto ainda dá tempo de alguém ir
 * atrás da internet, em vez de descobrir a perda dias depois.
 */
export const AVISO_MINUTOS = 10;
export const ALARME_MINUTOS = 20;

export function minutosDeEspera(desde: string | null): number {
  if (!desde) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60_000));
}

/** "23 minutos", "2h13", "2 dias e 3h" — o que couber num selo e se leia de longe. */
export function formatarEspera(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h${String(minutos % 60).padStart(2, '0')}`;

  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return `${dias} dia${dias > 1 ? 's' : ''}${resto > 0 ? ` e ${resto}h` : ''}`;
}
