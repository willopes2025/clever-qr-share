import { describe, expect, it } from 'vitest';
import { DEFAULT_SCALE_CONFIG, ean13CheckDigit, isValidEan13, parseScaleBarcode } from './scale-barcode';

/** Monta a etiqueta como a balança do quiosque imprimiria. */
function scaleLabel(itemCode: string, value: string): string {
  const body = `2${itemCode}${value}`;
  return body + ean13CheckDigit(body);
}

describe('código de barras de balança', () => {
  it('lê o peso embutido na etiqueta', () => {
    const parsed = parseScaleBarcode(scaleLabel('000042', '00412'));
    expect(parsed?.itemCode).toBe('000042');
    expect(parsed?.weightKg).toBeCloseTo(0.412, 4);
  });

  it('lê o valor embutido quando a balança imprime preço', () => {
    const parsed = parseScaleBarcode(scaleLabel('000042', '02468'), {
      ...DEFAULT_SCALE_CONFIG,
      layout: 'price',
    });
    expect(parsed?.priceCents).toBe(2468);
  });

  it('ignora código de produto industrializado', () => {
    expect(parseScaleBarcode('7891234567895')).toBeNull();
  });

  it('ignora código com tamanho errado', () => {
    expect(parseScaleBarcode('20004200412')).toBeNull();
  });

  it('a etiqueta gerada é um EAN-13 válido', () => {
    expect(isValidEan13(scaleLabel('000042', '00412'))).toBe(true);
  });
});

describe('EAN-13', () => {
  it('calcula o dígito verificador', () => {
    expect(ean13CheckDigit('789123456789')).toBe(5);
  });

  it('recusa código corrompido', () => {
    expect(isValidEan13('7891234567890')).toBe(false);
  });
});
