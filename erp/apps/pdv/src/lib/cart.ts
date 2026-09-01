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
  weighed: boolean;
}

export function buildLine(
  item: CachedCatalogItem,
  quantity: number,
  lineNumber: number,
  options: { weighed?: boolean; overrideTotalCents?: number } = {},
): CartLine {
  const totalCents =
    options.overrideTotalCents ?? multiplyByQuantity(item.priceCents, quantity);

  return {
    lineNumber,
    skuId: item.skuId,
    description: item.description,
    quantity,
    unit: item.unit,
    unitPriceCents: item.priceCents,
    discountCents: 0,
    totalCents,
    weighed: options.weighed ?? item.soldByWeight,
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
