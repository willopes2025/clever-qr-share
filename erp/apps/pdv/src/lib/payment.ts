import { sumCents } from '@soul/money';
import type { SalePaymentInput } from '@soul/contracts';

/** Quanto ainda falta receber. Negativo significa que já entrou mais que o total. */
export function outstandingAmount(totalCents: number, payments: readonly SalePaymentInput[]): number {
  return totalCents - sumCents(payments.map((payment) => payment.amountCents));
}

/** Troco só sai em dinheiro: não se devolve em cartão o que entrou a mais. */
export function calculateChange(totalCents: number, payments: readonly SalePaymentInput[]): number {
  const tendered = sumCents(payments.map((payment) => payment.amountCents));
  const surplus = tendered - totalCents;
  if (surplus <= 0) return 0;

  const cash = sumCents(
    payments.filter((payment) => payment.method === 'cash').map((payment) => payment.amountCents),
  );
  return Math.min(surplus, cash);
}
