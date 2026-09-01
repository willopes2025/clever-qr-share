/**
 * Código de barras gerado pela balança do quiosque.
 *
 * A etiqueta impressa na balança carrega o peso (ou o valor) dentro do próprio
 * código, no padrão EAN-13 com prefixo 2:
 *
 *   2 CCCCCC PPPPP D   → peso em gramas   (13 dígitos)
 *   2 CCCCCC VVVVV D   → valor em centavos (13 dígitos)
 *
 * A máscara varia por fabricante, por isso é configuração da loja e não constante
 * de código. Errar aqui significa cobrar o preço errado em toda venda por peso.
 */
export type ScaleBarcodeLayout = 'weight' | 'price';

export interface ScaleBarcodeConfig {
  prefix: string;
  layout: ScaleBarcodeLayout;
  itemCodeLength: number;
  valueLength: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  prefix: '2',
  layout: 'weight',
  itemCodeLength: 6,
  valueLength: 5,
};

export interface ScaleBarcode {
  itemCode: string;
  /** Quilos, quando o layout é por peso. */
  weightKg?: number;
  /** Centavos, quando o layout é por valor. */
  priceCents?: number;
}

export function isScaleBarcode(code: string, config: ScaleBarcodeConfig = DEFAULT_SCALE_CONFIG): boolean {
  return code.length === 13 && code.startsWith(config.prefix) && /^\d{13}$/.test(code);
}

export function parseScaleBarcode(
  code: string,
  config: ScaleBarcodeConfig = DEFAULT_SCALE_CONFIG,
): ScaleBarcode | null {
  if (!isScaleBarcode(code, config)) return null;

  const start = config.prefix.length;
  const itemCode = code.slice(start, start + config.itemCodeLength);
  const rawValue = code.slice(start + config.itemCodeLength, start + config.itemCodeLength + config.valueLength);
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;

  return config.layout === 'weight'
    ? { itemCode, weightKg: value / 1000 }
    : { itemCode, priceCents: value };
}

/** Dígito verificador do EAN-13 — usado ao gerar etiqueta e ao conferir leitura. */
export function ean13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new RangeError('EAN-13 exige 12 dígitos para calcular o verificador');
  }
  const sum = twelveDigits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}
