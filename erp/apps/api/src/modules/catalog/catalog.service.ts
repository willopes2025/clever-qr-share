import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError } from '../../common/errors/domain-error';

export interface CatalogItem {
  skuId: string;
  code: string;
  description: string;
  categoryName: string | null;
  unit: string;
  priceCents: number;
  barcodes: string[];
  trackLot: boolean;
}

export interface BarcodeLookup {
  item: CatalogItem;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catálogo completo da loja para o PDV guardar localmente.
   * É o que permite vender offline: sem esta cópia, não há venda sem internet.
   */
  async listForStore(tenantId: string, storeId: string): Promise<CatalogItem[]> {
    const skus = await this.prisma.sku.findMany({
      where: { tenantId, active: true, product: { active: true } },
      include: {
        product: { include: { category: true } },
        barcodes: true,
        prices: {
          where: {
            OR: [{ storeId }, { storeId: null }],
            validFrom: { lte: new Date() },
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
          },
          orderBy: [{ storeId: 'desc' }, { validFrom: 'desc' }],
        },
      },
      orderBy: { description: 'asc' },
    });

    return skus
      .filter((sku) => sku.prices.length > 0)
      .map((sku) => ({
        skuId: sku.id,
        code: sku.code,
        description: sku.description,
        categoryName: sku.product.category?.name ?? null,
        unit: sku.product.unit,
        // Preço específico da loja vence o preço padrão do tenant (ordenação acima).
        priceCents: Number(sku.prices[0]!.priceCents),
        barcodes: sku.barcodes.map((barcode) => barcode.code),
        trackLot: sku.trackLot,
      }));
  }

  /**
   * Resolve a leitura do scanner: código de barras do produto ou código interno.
   * O PDV faz isso localmente pelo catálogo em cache; aqui serve retaguarda e testes.
   */
  async lookupBarcode(tenantId: string, storeId: string, code: string): Promise<BarcodeLookup> {
    const barcode = await this.prisma.barcode.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (barcode) return { item: await this.findBySkuId(tenantId, storeId, barcode.skuId) };

    return { item: await this.findByCode(tenantId, storeId, code) };
  }

  private async findByCode(tenantId: string, storeId: string, code: string): Promise<CatalogItem> {
    const normalized = code.replace(/^0+/, '');
    const sku = await this.prisma.sku.findFirst({
      where: { tenantId, active: true, OR: [{ code }, { code: normalized }] },
    });
    if (!sku) throw new NotFoundError('produto', code);
    return this.findBySkuId(tenantId, storeId, sku.id);
  }

  private async findBySkuId(tenantId: string, storeId: string, skuId: string): Promise<CatalogItem> {
    const catalog = await this.listForStore(tenantId, storeId);
    const item = catalog.find((entry) => entry.skuId === skuId);
    if (!item) throw new NotFoundError('produto', skuId);
    return item;
  }
}
