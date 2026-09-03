import { describe, expect, it } from 'vitest';
import { weightedAverageCost } from './average-cost';

describe('custo médio ponderado', () => {
  it('primeira compra define o custo', () => {
    expect(
      weightedAverageCost({
        quantityBefore: 0,
        averageCostCentsBefore: 0,
        quantityIn: 10,
        unitCostCentsIn: 1200,
      }),
    ).toBe(1200);
  });

  it('pondera pela quantidade, não pela média das duas compras', () => {
    // 90 potes a R$ 12,00 e 10 a R$ 22,00 dá R$ 13,00 — não R$ 17,00.
    expect(
      weightedAverageCost({
        quantityBefore: 90,
        averageCostCentsBefore: 1200,
        quantityIn: 10,
        unitCostCentsIn: 2200,
      }),
    ).toBe(1300);
  });

  it('saldo negativo não contamina a média', () => {
    // O saldo fica negativo quando se vende sem ter cadastrado a entrada.
    // Ponderar com -5 daria um custo absurdo; a entrada é que manda.
    expect(
      weightedAverageCost({
        quantityBefore: -5,
        averageCostCentsBefore: 1200,
        quantityIn: 10,
        unitCostCentsIn: 1500,
      }),
    ).toBe(1500);
  });

  it('arredonda para centavo inteiro', () => {
    const media = weightedAverageCost({
      quantityBefore: 3,
      averageCostCentsBefore: 1000,
      quantityIn: 1,
      unitCostCentsIn: 1001,
    });
    expect(Number.isInteger(media)).toBe(true);
    expect(media).toBe(1000);
  });

  it('entrada com custo zero (brinde) puxa a média para baixo', () => {
    expect(
      weightedAverageCost({
        quantityBefore: 10,
        averageCostCentsBefore: 1000,
        quantityIn: 10,
        unitCostCentsIn: 0,
      }),
    ).toBe(500);
  });
});
