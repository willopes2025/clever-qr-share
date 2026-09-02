import { describe, expect, it } from 'vitest';
import { InsufficientStockError, allocateAvailable, allocateFefo, lotsExpiringWithin } from './fefo';

const hoje = new Date('2026-09-14T12:00:00-03:00');
const dia = (iso: string) => new Date(`${iso}T00:00:00-03:00`);

describe('consumo FEFO', () => {
  it('consome primeiro o lote que vence antes', () => {
    const allocations = allocateFefo(
      [
        { lotId: 'novo', quantity: 10, expiresAt: dia('2026-12-01') },
        { lotId: 'velho', quantity: 4, expiresAt: dia('2026-09-30') },
      ],
      3,
      { now: hoje },
    );
    expect(allocations).toEqual([{ lotId: 'velho', quantity: 3 }]);
  });

  it('divide a baixa entre lotes quando um só não cobre', () => {
    const allocations = allocateFefo(
      [
        { lotId: 'a', quantity: 2, expiresAt: dia('2026-09-30') },
        { lotId: 'b', quantity: 5, expiresAt: dia('2026-10-30') },
      ],
      4,
      { now: hoje },
    );
    expect(allocations).toEqual([
      { lotId: 'a', quantity: 2 },
      { lotId: 'b', quantity: 2 },
    ]);
  });

  it('nunca consome lote vencido', () => {
    expect(() =>
      allocateFefo([{ lotId: 'vencido', quantity: 50, expiresAt: dia('2026-09-01') }], 1, { now: hoje }),
    ).toThrow(InsufficientStockError);
  });

  it('recusa baixa maior que o saldo disponível', () => {
    expect(() =>
      allocateFefo([{ lotId: 'a', quantity: 1, expiresAt: dia('2026-12-01') }], 2, { now: hoje }),
    ).toThrow(InsufficientStockError);
  });

  it('aceita quantidade fracionada de venda por peso', () => {
    const allocations = allocateFefo(
      [{ lotId: 'a', quantity: 5, expiresAt: dia('2026-12-01') }],
      0.412,
      { now: hoje },
    );
    expect(allocations).toEqual([{ lotId: 'a', quantity: 0.412 }]);
  });

  it('deixa lote sem validade por último', () => {
    const allocations = allocateFefo(
      [
        { lotId: 'sem-data', quantity: 10, expiresAt: null },
        { lotId: 'com-data', quantity: 1, expiresAt: dia('2026-10-01') },
      ],
      2,
      { now: hoje },
    );
    expect(allocations[0]?.lotId).toBe('com-data');
  });
});

describe('alerta de validade', () => {
  it('lista os lotes que vencem dentro do prazo de alerta', () => {
    const expiring = lotsExpiringWithin(
      [
        { lotId: 'perto', quantity: 3, expiresAt: dia('2026-09-20') },
        { lotId: 'longe', quantity: 3, expiresAt: dia('2026-12-20') },
      ],
      10,
      hoje,
    );
    expect(expiring.map((lot) => lot.lotId)).toEqual(['perto']);
  });
});

describe('baixa que não recusa a venda', () => {
  const hoje = new Date('2026-09-02T12:00:00Z');

  it('sem estoque nenhum, baixa nada e acusa a falta inteira', () => {
    const resultado = allocateAvailable([], 3, { now: hoje });
    expect(resultado.allocations).toEqual([]);
    expect(resultado.shortfall).toBe(3);
  });

  it('com estoque parcial, consome o que existe e acusa o resto', () => {
    const resultado = allocateAvailable(
      [{ lotId: 'A', quantity: 2, expiresAt: new Date('2026-10-01') }],
      5,
      { now: hoje },
    );
    expect(resultado.allocations).toEqual([{ lotId: 'A', quantity: 2 }]);
    expect(resultado.shortfall).toBe(3);
  });

  it('com estoque suficiente, não acusa falta e respeita o FEFO', () => {
    const resultado = allocateAvailable(
      [
        { lotId: 'novo', quantity: 10, expiresAt: new Date('2026-12-01') },
        { lotId: 'velho', quantity: 4, expiresAt: new Date('2026-10-01') },
      ],
      6,
      { now: hoje },
    );
    expect(resultado.shortfall).toBe(0);
    expect(resultado.allocations[0]).toEqual({ lotId: 'velho', quantity: 4 });
    expect(resultado.allocations[1]).toEqual({ lotId: 'novo', quantity: 2 });
  });

  it('lote vencido não entra na conta: vira falta, não venda de produto vencido', () => {
    const resultado = allocateAvailable(
      [{ lotId: 'vencido', quantity: 50, expiresAt: new Date('2026-08-01') }],
      2,
      { now: hoje },
    );
    expect(resultado.allocations).toEqual([]);
    expect(resultado.shortfall).toBe(2);
  });
});
