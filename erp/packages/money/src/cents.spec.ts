import { describe, expect, it } from 'vitest';
import { allocateCents, formatBRL, multiplyByQuantity, percentOf, sumCents, toCents } from './cents';

describe('conversão de valores', () => {
  it('converte reais em centavos a partir de número e de texto brasileiro', () => {
    expect(toCents(59.9)).toBe(5990);
    expect(toCents('59,90')).toBe(5990);
    expect(toCents('1.234,56')).toBe(123456);
  });

  it('arredonda meio para cima em vez de truncar', () => {
    expect(toCents(0.005)).toBe(1);
  });

  it('formata no padrão brasileiro', () => {
    expect(formatBRL(2468).replace(/ /g, ' ')).toBe('R$ 24,68');
  });
});

describe('venda por peso', () => {
  it('multiplica preço por quilo pela quantidade pesada', () => {
    expect(multiplyByQuantity(5990, 0.412)).toBe(2468);
  });

  it('recusa quantidade negativa', () => {
    expect(() => multiplyByQuantity(5990, -1)).toThrow(RangeError);
  });
});

describe('rateio de desconto', () => {
  it('distribui sem perder nem criar centavo', () => {
    const parts = allocateCents(100, [1, 1, 1]);
    expect(sumCents(parts)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('distribui proporcionalmente ao peso de cada item', () => {
    const parts = allocateCents(1000, [2468, 300, 1500]);
    expect(sumCents(parts)).toBe(1000);
    expect(parts[0]).toBeGreaterThan(parts[1] as number);
  });

  it('mantém o total mesmo com muitos itens', () => {
    const weights = Array.from({ length: 37 }, (_, i) => i + 1);
    expect(sumCents(allocateCents(999, weights))).toBe(999);
  });
});

describe('percentual', () => {
  it('calcula taxa de cartão sobre o valor bruto', () => {
    expect(percentOf(10000, 2.99)).toBe(299);
  });
});
