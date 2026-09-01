import { allocateCents, multiplyByQuantity, sumCents, type Cents } from '@soul/money';

/**
 * Aritmética da venda. Fica separada de banco e de framework para poder ser
 * testada à exaustão — é aqui que mora o dinheiro do cliente.
 */
export interface PricedItem {
  quantity: number;
  unitPriceCents: Cents;
  discountCents?: Cents;
}

export interface SaleTotals {
  grossCents: Cents;
  itemDiscountCents: Cents;
  headerDiscountCents: Cents;
  totalCents: Cents;
  /** Desconto do total rateado por item — é assim que ele vai para a nota fiscal. */
  allocatedDiscounts: Cents[];
}

export function lineTotal(item: PricedItem): Cents {
  const gross = multiplyByQuantity(item.unitPriceCents, item.quantity);
  const discount = item.discountCents ?? 0;
  if (discount > gross) {
    throw new RangeError('Desconto do item não pode superar o valor do item');
  }
  return gross - discount;
}

export function calculateTotals(items: readonly PricedItem[], headerDiscountCents: Cents = 0): SaleTotals {
  if (items.length === 0) throw new RangeError('Venda precisa de ao menos um item');

  const lineTotals = items.map(lineTotal);
  const gross = sumCents(items.map((item) => multiplyByQuantity(item.unitPriceCents, item.quantity)));
  const itemDiscount = sumCents(items.map((item) => item.discountCents ?? 0));
  const afterItemDiscounts = sumCents(lineTotals);

  if (headerDiscountCents > afterItemDiscounts) {
    throw new RangeError('Desconto do total não pode superar o valor da venda');
  }

  return {
    grossCents: gross,
    itemDiscountCents: itemDiscount,
    headerDiscountCents,
    totalCents: afterItemDiscounts - headerDiscountCents,
    allocatedDiscounts: headerDiscountCents > 0 ? allocateCents(headerDiscountCents, lineTotals) : lineTotals.map(() => 0),
  };
}

export interface TenderedPayment {
  amountCents: Cents;
  changeCents?: Cents;
  method: string;
}

/** Quanto ainda falta receber (positivo) ou quanto sobrou como troco (negativo). */
export function outstandingAmount(totalCents: Cents, payments: readonly TenderedPayment[]): Cents {
  const settled = sumCents(payments.map((payment) => payment.amountCents - (payment.changeCents ?? 0)));
  return totalCents - settled;
}

export function calculateChange(totalCents: Cents, payments: readonly TenderedPayment[]): Cents {
  const tendered = sumCents(payments.map((payment) => payment.amountCents));
  const change = tendered - totalCents;
  if (change <= 0) return 0;

  const cashTendered = sumCents(
    payments.filter((payment) => payment.method === 'cash').map((payment) => payment.amountCents),
  );
  // Troco só sai em dinheiro: não se devolve em cartão o que entrou a mais.
  return Math.min(change, cashTendered);
}
