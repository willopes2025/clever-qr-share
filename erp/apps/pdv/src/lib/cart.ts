import { multiplyByQuantity } from '@soul/money';
import type { CachedCatalogItem } from './db';

/** Item já no carrinho, com o preço praticado congelado no momento da venda. */
export interface CartLine {
  lineNumber: number;
  skuId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
}

export function buildLine(item: CachedCatalogItem, quantity: number, lineNumber: number): CartLine {
  return {
    lineNumber,
    skuId: item.skuId,
    description: item.description,
    quantity,
    unit: item.unit,
    unitPriceCents: item.priceCents,
    discountCents: 0,
    totalCents: multiplyByQuantity(item.priceCents, quantity),
  };
}

/**
 * Ler o mesmo pote duas vezes soma na linha em vez de criar outra — é o que o
 * atendente espera quando passa três potes iguais.
 */
export function addToCart(lines: readonly CartLine[], item: CachedCatalogItem, quantity = 1): CartLine[] {
  const existing = lines.find((line) => line.skuId === item.skuId);
  if (existing) {
    return lines.map((line) =>
      line.skuId === item.skuId ? changeQuantity(line, line.quantity + quantity) : line,
    );
  }
  return [...lines, buildLine(item, quantity, lines.length + 1)];
}

/** Quantidade zero ou negativa remove a linha. */
export function changeQuantity(line: CartLine, quantity: number): CartLine {
  return {
    ...line,
    quantity,
    totalCents: multiplyByQuantity(line.unitPriceCents, quantity) - line.discountCents,
  };
}

export function renumber(lines: CartLine[]): CartLine[] {
  return lines.map((line, index) => ({ ...line, lineNumber: index + 1 }));
}

export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.totalCents, 0);
}

/** Busca por descrição sem acento, código ou código de barras — como o caixa digita. */
export function searchCatalog(items: readonly CachedCatalogItem[], term: string): CachedCatalogItem[] {
  const normalized = normalize(term);
  if (!normalized) return [];

  return items
    .filter(
      (item) =>
        normalize(item.description).includes(normalized) ||
        item.code.includes(normalized) ||
        item.barcodes.some((barcode) => barcode.includes(normalized)),
    )
    .slice(0, 12);
}

export function findByBarcode(
  items: readonly CachedCatalogItem[],
  code: string,
): CachedCatalogItem | undefined {
  return items.find((item) => item.barcodes.includes(code) || item.code === code);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
