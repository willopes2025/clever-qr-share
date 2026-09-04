import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';

export interface ProductListItem {
  id: string;
  name: string;
  categoryName: string | null;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  origin: number;
  active: boolean;
  skus: Array<{
    id: string;
    code: string;
    description: string;
    unit: string;
    priceCents: number | null;
    barcode: string | null;
    active: boolean;
  }>;
}

export interface SaveProductInput {
  name: string;
  categoryId?: string | null;
  ncm?: string | null;
  /**
   * CEST. Preenchê-lo é o que diz ao fiscal que o produto está em substituição
   * tributária — e é o campo cuja ausência mais rejeita NFC-e de sorveteria.
   */
  cest?: string | null;
  cfop?: string | null;
  origin?: number | null;
  active?: boolean;
  skus: Array<{
    id?: string;
    code: string;
    description: string;
    /** Unidade do estoque: UN, KG, G, L, ML. Calda em litro, granel em quilo. */
    unit?: string;
    priceCents: number;
    barcode?: string | null;
    active?: boolean;
  }>;
}

/**
 * Cadastro de produto pela retaguarda.
 *
 * Um produto é sempre salvo junto com seus SKUs, porque é assim que a pessoa
 * pensa: "Pote de sorvete" com os sabores e tamanhos que existem. Preço nunca é
 * alterado no lugar — cria-se uma vigência nova, preservando o histórico das
 * vendas já feitas.
 */
@Injectable()
export class ProductAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, search?: string): Promise<ProductListItem[]> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { skus: { some: { description: { contains: search, mode: 'insensitive' } } } },
                { skus: { some: { code: { contains: search } } } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        skus: {
          include: {
            barcodes: { take: 1 },
            prices: {
              where: { storeId: null, validTo: null },
              orderBy: { validFrom: 'desc' },
              take: 1,
            },
          },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      categoryName: product.category?.name ?? null,
      ncm: product.ncm,
      cest: product.cest,
      cfop: product.cfop,
      origin: product.origin,
      active: product.active,
      skus: product.skus.map((sku) => ({
        id: sku.id,
        code: sku.code,
        description: sku.description,
        unit: sku.unit,
        priceCents: sku.prices[0] ? Number(sku.prices[0].priceCents) : null,
        barcode: sku.barcodes[0]?.code ?? null,
        active: sku.active,
      })),
    }));
  }

  async categories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    });
  }

  /** Cria uma categoria nova. Some entra no fim da lista, por ordem de criação. */
  async createCategory(tenantId: string, name: string): Promise<{ id: string; name: string }> {
    const existing = await this.prisma.category.findFirst({ where: { tenantId, name } });
    if (existing) {
      throw new ConflictError('CATEGORY_NAME_IN_USE', 'Já existe uma categoria com esse nome', { name });
    }

    const last = await this.prisma.category.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
    const category = await this.prisma.category.create({
      data: { tenantId, name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      select: { id: true, name: true },
    });
    return category;
  }

  /** Renomeia uma categoria existente. Produtos continuam apontando para o mesmo id. */
  async renameCategory(tenantId: string, categoryId: string, name: string): Promise<void> {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) throw new NotFoundError('Categoria', categoryId);

    const clash = await this.prisma.category.findFirst({
      where: { tenantId, name, id: { not: categoryId } },
    });
    if (clash) {
      throw new ConflictError('CATEGORY_NAME_IN_USE', 'Já existe uma categoria com esse nome', { name });
    }

    await this.prisma.category.update({ where: { id: categoryId }, data: { name } });
  }

  async create(tenantId: string, input: SaveProductInput): Promise<{ id: string }> {
    await this.assertCodesAvailable(tenantId, input.skus.map((sku) => sku.code));

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          name: input.name,
          categoryId: input.categoryId ?? null,
          ncm: input.ncm ?? null,
          cest: normalizeDigits(input.cest, 7),
          // Sem CFOP informado, o padrão segue o CEST: produto em substituição
          // tributária vende com 5405, os demais com 5102.
          cfop: input.cfop ?? defaultCfop(input.cest),
          origin: input.origin ?? 0,
          unit: 'UN',
          kind: input.skus.length > 1 ? 'grid' : 'simple',
        },
      });

      for (const sku of input.skus) {
        await this.createSku(tx, tenantId, product.id, sku);
      }
      return { id: product.id };
    });
  }

  async update(tenantId: string, productId: string, input: SaveProductInput): Promise<{ id: string }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { skus: true },
    });
    if (!product) throw new NotFoundError('produto', productId);

    const newCodes = input.skus.filter((sku) => !sku.id).map((sku) => sku.code);
    await this.assertCodesAvailable(tenantId, newCodes);

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          name: input.name,
          categoryId: input.categoryId ?? null,
          ncm: input.ncm ?? null,
          cest: normalizeDigits(input.cest, 7),
          cfop: input.cfop ?? defaultCfop(input.cest),
          origin: input.origin ?? 0,
          active: input.active ?? true,
        },
      });

      for (const sku of input.skus) {
        if (sku.id) await this.updateSku(tx, tenantId, sku.id, sku);
        else await this.createSku(tx, tenantId, productId, sku);
      }

      // SKU que sumiu do formulário é desativado, nunca apagado: ele aparece em
      // vendas antigas, e apagar quebraria o histórico.
      const kept = new Set(input.skus.map((sku) => sku.id).filter(Boolean));
      const removed = product.skus.filter((sku) => !kept.has(sku.id));
      if (removed.length > 0) {
        await tx.sku.updateMany({
          where: { id: { in: removed.map((sku) => sku.id) } },
          data: { active: false },
        });
      }

      return { id: productId };
    });
  }

  private async createSku(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    input: SaveProductInput['skus'][number],
  ): Promise<void> {
    const sku = await tx.sku.create({
      data: {
        tenantId,
        productId,
        code: input.code,
        description: input.description,
        unit: input.unit ?? 'UN',
        active: input.active ?? true,
      },
    });
    await this.savePrice(tx, tenantId, sku.id, input.priceCents);
    await this.saveBarcode(tx, tenantId, sku.id, input.barcode);
  }

  private async updateSku(
    tx: Prisma.TransactionClient,
    tenantId: string,
    skuId: string,
    input: SaveProductInput['skus'][number],
  ): Promise<void> {
    const current = await tx.sku.findFirst({
      where: { id: skuId, tenantId },
      include: {
        prices: { where: { storeId: null, validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 },
        barcodes: { take: 1 },
      },
    });
    if (!current) throw new NotFoundError('SKU', skuId);

    await tx.sku.update({
      where: { id: skuId },
      data: {
        description: input.description,
        unit: input.unit ?? 'UN',
        active: input.active ?? true,
      },
    });

    const currentPrice = current.prices[0] ? Number(current.prices[0].priceCents) : null;
    if (currentPrice !== input.priceCents) {
      await this.savePrice(tx, tenantId, skuId, input.priceCents, current.prices[0]?.id);
    }

    const currentBarcode = current.barcodes[0]?.code ?? null;
    if (currentBarcode !== (input.barcode ?? null)) {
      if (currentBarcode) {
        await tx.barcode.delete({ where: { tenantId_code: { tenantId, code: currentBarcode } } });
      }
      await this.saveBarcode(tx, tenantId, skuId, input.barcode);
    }
  }

  /** Preço novo encerra a vigência anterior em vez de sobrescrevê-la. */
  private async savePrice(
    tx: Prisma.TransactionClient,
    tenantId: string,
    skuId: string,
    priceCents: number,
    previousPriceId?: string,
  ): Promise<void> {
    const now = new Date();
    if (previousPriceId) {
      await tx.price.update({ where: { id: previousPriceId }, data: { validTo: now } });
    }
    await tx.price.create({
      data: { tenantId, skuId, priceCents: BigInt(priceCents), validFrom: now },
    });
  }

  private async saveBarcode(
    tx: Prisma.TransactionClient,
    tenantId: string,
    skuId: string,
    code?: string | null,
  ): Promise<void> {
    if (!code) return;
    const existing = await tx.barcode.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (existing && existing.skuId !== skuId) {
      throw new ConflictError('BARCODE_IN_USE', 'Este código de barras já pertence a outro produto', {
        code,
      });
    }
    if (!existing) {
      await tx.barcode.create({ data: { tenantId, code, skuId, kind: 'ean' } });
    }
  }

  private async assertCodesAvailable(tenantId: string, codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    const taken = await this.prisma.sku.findMany({
      where: { tenantId, code: { in: codes } },
      select: { code: true },
    });
    if (taken.length > 0) {
      throw new ConflictError('SKU_CODE_IN_USE', 'Código interno já usado por outro produto', {
        codes: taken.map((sku) => sku.code),
      });
    }
  }
}

/** Guarda o código só com dígitos, no tamanho exato, ou nada. */
function normalizeDigits(value: string | null | undefined, length: number): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === length ? digits : null;
}

function defaultCfop(cest: string | null | undefined): string {
  return normalizeDigits(cest, 7) ? '5405' : '5102';
}
