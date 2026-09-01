import { sumCents, type Cents } from '@soul/money';

/**
 * Fechamento de caixa com conferência cega: o operador digita o que contou
 * sem ver o esperado, e o sistema aponta a diferença por meio de pagamento.
 */
export interface CashSessionSnapshot {
  openingFloatCents: Cents;
  /** Vendas do turno, por meio de pagamento. */
  salesByMethod: Record<string, Cents>;
  withdrawalsCents: Cents;
  suppliesCents: Cents;
  changeGivenCents: Cents;
}

export type CountedByMethod = Record<string, Cents>;

export interface CashClosingResult {
  expected: Record<string, Cents>;
  counted: CountedByMethod;
  differenceByMethod: Record<string, Cents>;
  differenceCents: Cents;
  requiresJustification: boolean;
}

export function calculateExpected(snapshot: CashSessionSnapshot): Record<string, Cents> {
  const expected: Record<string, Cents> = { ...snapshot.salesByMethod };

  // Só o dinheiro na gaveta é afetado por fundo de troco, sangria e suprimento.
  expected.cash =
    (snapshot.salesByMethod.cash ?? 0) +
    snapshot.openingFloatCents +
    snapshot.suppliesCents -
    snapshot.withdrawalsCents -
    snapshot.changeGivenCents;

  return expected;
}

export function closeCashSession(
  snapshot: CashSessionSnapshot,
  counted: CountedByMethod,
): CashClosingResult {
  const expected = calculateExpected(snapshot);
  const methods = new Set([...Object.keys(expected), ...Object.keys(counted)]);

  const differenceByMethod: Record<string, Cents> = {};
  for (const method of methods) {
    differenceByMethod[method] = (counted[method] ?? 0) - (expected[method] ?? 0);
  }

  const differenceCents = sumCents(Object.values(differenceByMethod));

  return {
    expected,
    counted,
    differenceByMethod,
    differenceCents,
    requiresJustification: differenceCents !== 0,
  };
}
