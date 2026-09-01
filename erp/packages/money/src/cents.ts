/**
 * Dinheiro no Soul ERP é sempre inteiro de centavos.
 *
 * Ponto flutuante para valor monetário produz erro de arredondamento que
 * aparece no fechamento de caixa e na nota fiscal. Todo cálculo passa por aqui.
 */
export type Cents = number;

const CENTS_PER_UNIT = 100;

export function isValidCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertCents(value: number, field = 'valor'): Cents {
  if (!isValidCents(value)) {
    throw new RangeError(`${field} deve ser inteiro de centavos, recebido: ${value}`);
  }
  return value;
}

/** Converte reais (ex.: "59,90" ou 59.9) para centavos, arredondando meio para cima. */
export function toCents(reais: number | string): Cents {
  const normalized = typeof reais === 'string' ? Number(reais.replace(/\./g, '').replace(',', '.')) : reais;
  if (!Number.isFinite(normalized)) {
    throw new RangeError(`Valor monetário inválido: ${reais}`);
  }
  return Math.round(normalized * CENTS_PER_UNIT);
}

export function formatBRL(cents: Cents): string {
  assertCents(cents);
  return (cents / CENTS_PER_UNIT).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => total + assertCents(value), 0);
}

/**
 * Multiplica um valor unitário por uma quantidade fracionada (peso, por exemplo)
 * arredondando meio para cima — a regra usada no varejo brasileiro.
 */
export function multiplyByQuantity(unitCents: Cents, quantity: number): Cents {
  assertCents(unitCents, 'valor unitário');
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`Quantidade inválida: ${quantity}`);
  }
  return Math.round(unitCents * quantity);
}

export function percentOf(cents: Cents, percent: number): Cents {
  assertCents(cents);
  return Math.round((cents * percent) / 100);
}

/**
 * Rateia um valor entre pesos (ex.: desconto do total distribuído nos itens)
 * sem perder nem criar centavo: a sobra vai para as maiores frações.
 */
export function allocateCents(total: Cents, weights: readonly number[]): Cents[] {
  assertCents(total, 'total a ratear');
  if (weights.length === 0) return [];

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    throw new RangeError('Rateio exige ao menos um peso positivo');
  }

  const exact = weights.map((weight) => (total * weight) / weightSum);
  const floors = exact.map((value) => Math.floor(value));
  const remainder = total - floors.reduce((sum, value) => sum + value, 0);

  const orderByFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (let i = 0; i < remainder; i += 1) {
    const target = orderByFraction[i % orderByFraction.length];
    if (target) result[target.index] = (result[target.index] ?? 0) + 1;
  }
  return result;
}
