import { describe, expect, it } from 'vitest';
import { calculateChange, calculateTotals, lineTotal, outstandingAmount } from './sale-totals';

describe('total do item', () => {
  it('calcula item por unidade', () => {
    expect(lineTotal({ quantity: 3, unitPriceCents: 300 })).toBe(900);
  });

  it('calcula item por peso arredondando o centavo', () => {
    expect(lineTotal({ quantity: 0.412, unitPriceCents: 5990 })).toBe(2468);
  });

  it('recusa desconto maior que o item', () => {
    expect(() => lineTotal({ quantity: 1, unitPriceCents: 100, discountCents: 200 })).toThrow(RangeError);
  });
});

describe('totais da venda', () => {
  const carrinho = [
    { quantity: 0.412, unitPriceCents: 5990 }, // açaí no peso
    { quantity: 1, unitPriceCents: 300 },      // granola
  ];

  it('soma itens sem desconto', () => {
    const totals = calculateTotals(carrinho);
    expect(totals.grossCents).toBe(2768);
    expect(totals.totalCents).toBe(2768);
  });

  it('rateia o desconto do total entre os itens sem perder centavo', () => {
    const totals = calculateTotals(carrinho, 268);
    expect(totals.totalCents).toBe(2500);
    expect(totals.allocatedDiscounts.reduce((a, b) => a + b, 0)).toBe(268);
  });

  it('recusa desconto maior que a venda', () => {
    expect(() => calculateTotals(carrinho, 999_999)).toThrow(RangeError);
  });

  it('recusa venda sem item', () => {
    expect(() => calculateTotals([])).toThrow(RangeError);
  });
});

describe('pagamento', () => {
  it('aponta o quanto ainda falta receber', () => {
    expect(outstandingAmount(2768, [{ method: 'cash', amountCents: 1000 }])).toBe(1768);
  });

  it('calcula troco em dinheiro', () => {
    expect(calculateChange(2768, [{ method: 'cash', amountCents: 5000 }])).toBe(2232);
  });

  it('não devolve troco de pagamento em cartão', () => {
    expect(calculateChange(2768, [{ method: 'debit', amountCents: 3000 }])).toBe(0);
  });

  it('limita o troco ao dinheiro entregue em pagamento misto', () => {
    const change = calculateChange(2768, [
      { method: 'debit', amountCents: 2000 },
      { method: 'cash', amountCents: 1000 },
    ]);
    expect(change).toBe(232);
  });
});
