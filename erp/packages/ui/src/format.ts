/** Formatação pt-BR usada nas duas aplicações. */
const TIME_ZONE = 'America/Sao_Paulo';

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatQuantity(quantity: string | number, unit: string): string {
  const value = typeof quantity === 'string' ? Number(quantity) : quantity;
  if (unit === 'KG') return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg`;
  return `${value.toLocaleString('pt-BR')} un`;
}

export function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString('pt-BR', { timeZone: TIME_ZONE });
}

/** "há 3 min" — usado no monitor de terminais. */
export function formatRelative(value: Date | string | null): string {
  if (!value) return 'nunca';
  const elapsedMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}
