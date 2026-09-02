/**
 * O dia do negócio.
 *
 * O servidor roda em UTC, o quiosque vende em horário de Brasília. Sem tratar
 * isso, "hoje" no painel começa às 21h do dia anterior: o faturamento do dia
 * zera no meio do expediente e a curva por hora aparece três horas adiantada —
 * uma venda das 15h desenhada às 18h.
 *
 * O fuso é do negócio, não da máquina. Fica em BUSINESS_TIMEZONE para quando
 * houver quiosque em outro estado.
 */
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
}

/**
 * Meia-noite do dia do negócio que contém `reference`, como instante absoluto.
 *
 * Usa o próprio Intl para descobrir que horas são no fuso do quiosque naquele
 * instante e recua até o começo do dia. Assim o horário de verão — se voltar —
 * entra de graça, em vez de um deslocamento fixo que quebra duas vezes por ano.
 */
export function startOfBusinessDay(reference: Date, timeZone = businessTimezone()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(reference);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  // 24 aparece como hora de meia-noite em alguns ambientes; normaliza para 0.
  const hour = get('hour') % 24;

  const millisIntoDay = ((hour * 60 + get('minute')) * 60 + get('second')) * 1000;
  return new Date(reference.getTime() - millisIntoDay - reference.getMilliseconds());
}

/** Início e fim do dia do negócio: `[start, end)`. */
export function businessDayRange(
  reference: Date,
  timeZone = businessTimezone(),
): { start: Date; end: Date } {
  const start = startOfBusinessDay(reference, timeZone);
  // Somar 24h e recortar de novo cobre o dia de 23h ou 25h na virada do horário
  // de verão, em que somar um dia cru erraria por uma hora.
  const end = startOfBusinessDay(new Date(start.getTime() + 36 * 3_600_000), timeZone);
  return { start, end };
}
