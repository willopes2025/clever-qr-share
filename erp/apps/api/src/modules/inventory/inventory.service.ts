import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError } from '../../common/errors/domain-error';
import { allocateAvailable, type LotBalance } from './fefo';
import { weightedAverageCost } from './average-cost';

export interface StockConsumption {
  skuId: string;
  quantity: number;
  unitCostCents: bigint;
}

export interface StockShortfall {
  skuId: string;
  /** Quanto faltou em estoque no momento da venda. */
  quantity: number;
}

export interface ReceiptItem {
  skuId: string;
  quantity: number;
  unitCostCents: number;
  /** Lote do fabricante. Sorvete tem validade: sem lote não há FEFO. */
  lotCode?: string | null;
  expiresAt?: string | null;
}

export interface ReceiveInput {
  tenantId: string;
  storeId: string;
  userId: string;
  /** Nota do fornecedor, quando houver. Fica no motivo do movimento. */
  document?: string | null;
  items: ReceiptItem[];
}

export interface CountItem {
  skuId: string;
  /** Quanto foi contado na prateleira, não a diferença. */
  countedQuantity: number;
}

export interface CountInput {
  tenantId: string;
  storeId: string;
  userId: string;
  reason: string;
  items: CountItem[];
}

/** O que a contagem encontrou de diferente do que o sistema achava. */
export interface CountDifference {
  skuId: string;
  description: string;
  expected: number;
  counted: number;
  difference: number;
}

export interface ConsumeSaleInput {
  tenantId: string;
  storeId: string;
  saleId: string;
  userId: string;
  occurredAt: Date;
  items: StockConsumption[];
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Baixa de estoque da venda.
 *
 * Roda sempre dentro da mesma transação que grava a venda — estoque baixado sem
 * venda gravada (ou o contrário) é divergência que ninguém consegue explicar depois.
 *
 * Falta de estoque **não recusa a venda**. No balcão a venda já aconteceu: o
 * cliente pagou e saiu com o pote. Recusar o registro não desfaz nada — só faz
 * perder o faturamento e a nota fiscal daquela venda, que é o oposto do que o
 * sistema existe para fazer. O saldo fica negativo, que é a verdade do que
 * aconteceu, e a falta volta como aviso para quem cuida do inventário.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async consumeForSale(tx: TransactionClient, input: ConsumeSaleInput): Promise<StockShortfall[]> {
    const shortfalls: StockShortfall[] = [];

    for (const item of input.items) {
      const balances = await this.loadBalances(tx, input.tenantId, input.storeId, item.skuId);
      const { allocations, shortfall } = allocateAvailable(balances, item.quantity, {
        now: input.occurredAt,
      });

      // O que faltou sai do saldo sem lote: é lá que o negativo fica visível
      // para o acerto de inventário, sem sujar a validade de um lote real.
      if (shortfall > 0) {
        shortfalls.push({ skuId: item.skuId, quantity: shortfall });
        allocations.push({ lotId: null, quantity: shortfall });
      }

      for (const allocation of allocations) {
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId: allocation.lotId,
          quantity: -allocation.quantity,
          unitCostCents: item.unitCostCents,
          kind: 'sale',
          refType: 'sale',
          refId: input.saleId,
          userId: input.userId,
          occurredAt: input.occurredAt,
        });
      }
    }

    return shortfalls;
  }

  /** Devolução: o estoque volta para o mesmo lote de onde saiu. */
  async returnToStock(
    tx: TransactionClient,
    input: ConsumeSaleInput & { originalSaleId: string },
  ): Promise<void> {
    for (const item of input.items) {
      await this.applyMovement(tx, {
        tenantId: input.tenantId,
        storeId: input.storeId,
        skuId: item.skuId,
        lotId: null,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        kind: 'return',
        refType: 'sale',
        refId: input.originalSaleId,
        userId: input.userId,
        occurredAt: input.occurredAt,
      });
    }
  }

  /**
   * Entrada de mercadoria.
   *
   * É a porta que faltava: sem ela o estoque só sabia descer, e o saldo de
   * qualquer loja virava ficção depois da primeira venda.
   *
   * Atualiza o custo médio do SKU junto, porque é dele que sai a margem — e
   * margem calculada sobre custo velho engana mais do que não ter margem.
   */
  async receive(input: ReceiveInput): Promise<{ items: number; totalCostCents: number }> {
    if (input.items.length === 0) {
      throw new ConflictError('EMPTY_RECEIPT', 'A entrada precisa de ao menos um item');
    }

    const occurredAt = new Date();
    const reason = input.document ? `Entrada · nota ${input.document}` : 'Entrada de mercadoria';
    let totalCostCents = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw new ConflictError('INVALID_QUANTITY', 'Quantidade de entrada deve ser positiva', {
            skuId: item.skuId,
          });
        }

        const lotId = await this.resolveLot(tx, input.tenantId, item);
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId,
          quantity: item.quantity,
          unitCostCents: BigInt(item.unitCostCents),
          kind: 'purchase',
          refType: input.document ? 'supplier_note' : null,
          refId: input.document ?? null,
          reason,
          userId: input.userId,
          occurredAt,
        });

        await this.updateAverageCost(tx, input.tenantId, item);
        totalCostCents += item.unitCostCents * item.quantity;
      }
    });

    return { items: input.items.length, totalCostCents: Math.round(totalCostCents) };
  }

  /**
   * Contagem de inventário.
   *
   * Recebe o que foi contado na prateleira, não a diferença — quem conta não
   * deveria precisar fazer subtração de cabeça. O sistema calcula a diferença,
   * grava o ajuste e devolve o que estava errado, que é o dado que interessa.
   */
  async count(input: CountInput): Promise<CountDifference[]> {
    const differences: CountDifference[] = [];
    const occurredAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        if (item.countedQuantity < 0) {
          throw new ConflictError('INVALID_QUANTITY', 'Contagem não pode ser negativa', {
            skuId: item.skuId,
          });
        }

        const sku = await tx.sku.findFirst({
          where: { id: item.skuId, tenantId: input.tenantId },
          select: { description: true },
        });
        if (!sku) {
          throw new ConflictError('SKU_NOT_FOUND', 'Produto não encontrado', { skuId: item.skuId });
        }

        const balances = await this.loadBalances(tx, input.tenantId, input.storeId, item.skuId);
        const expected = balances.reduce((total, balance) => total + balance.quantity, 0);
        const difference = round4(item.countedQuantity - expected);
        if (difference === 0) continue;

        // O acerto sai do saldo sem lote: a contagem diz o total da prateleira,
        // não de qual lote sobrou — atribuir a um lote real seria inventar dado.
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId: null,
          quantity: difference,
          unitCostCents: 0n,
          kind: 'adjust',
          refType: 'count',
          refId: null,
          reason: input.reason,
          userId: input.userId,
          occurredAt,
        });

        differences.push({
          skuId: item.skuId,
          description: sku.description,
          expected,
          counted: item.countedQuantity,
          difference,
        });
      }
    });

    return differences;
  }

  async adjust(input: {
    tenantId: string;
    storeId: string;
    skuId: string;
    quantity: number;
    reason: string;
    userId: string;
  }): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.applyMovement(tx, {
        ...input,
        lotId: null,
        unitCostCents: 0n,
        kind: 'adjust',
        refType: null,
        refId: null,
        occurredAt: new Date(),
      }),
    );
  }

  /**
   * Saldo da loja, do jeito que a pessoa que repõe precisa ver: o que está
   * negativo primeiro, depois o que furou o mínimo, depois o resto.
   */
  async balances(
    tenantId: string,
    storeId: string,
    search?: string,
  ): Promise<
    Array<{
      skuId: string;
      code: string;
      description: string;
      quantity: number;
      minStock: number;
      avgCostCents: number;
      belowMinimum: boolean;
      negative: boolean;
      nextExpiry: string | null;
    }>
  > {
    const skus = await this.prisma.sku.findMany({
      where: {
        tenantId,
        active: true,
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: 'insensitive' as const } },
                { code: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { balances: { where: { storeId }, include: { lot: true } } },
      take: 500,
    });

    return skus
      .map((sku) => {
        const quantity = round4(
          sku.balances.reduce((total, balance) => total + Number(balance.quantity), 0),
        );
        const minStock = Number(sku.minStock);
        const expiries = sku.balances
          .filter((balance) => Number(balance.quantity) > 0 && balance.lot?.expiresAt)
          .map((balance) => balance.lot!.expiresAt!)
          .sort((a, b) => a.getTime() - b.getTime());

        return {
          skuId: sku.id,
          code: sku.code,
          description: sku.description,
          quantity,
          minStock,
          avgCostCents: Number(sku.avgCostCents),
          belowMinimum: minStock > 0 && quantity < minStock,
          negative: quantity < 0,
          nextExpiry: expiries[0]?.toISOString().slice(0, 10) ?? null,
        };
      })
      .sort((a, b) => {
        // Negativo antes de tudo: é erro de cadastro esperando conserto.
        if (a.negative !== b.negative) return a.negative ? -1 : 1;
        if (a.belowMinimum !== b.belowMinimum) return a.belowMinimum ? -1 : 1;
        return a.description.localeCompare(b.description);
      });
  }

  /** Extrato de um produto na loja: de onde veio e para onde foi cada unidade. */
  async movements(tenantId: string, storeId: string, skuId: string, limit = 100) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { tenantId, storeId, skuId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 500),
      include: { lot: { select: { lotCode: true, expiresAt: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      quantity: Number(row.quantity),
      unitCostCents: Number(row.unitCostCents),
      reason: row.reason,
      lotCode: row.lot?.lotCode ?? null,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  /** Acha ou cria o lote da entrada. Sem código de lote, o saldo é o sem-lote. */
  private async resolveLot(
    tx: TransactionClient,
    tenantId: string,
    item: ReceiptItem,
  ): Promise<string | null> {
    const lotCode = item.lotCode?.trim();
    if (!lotCode) return null;

    const existing = await tx.stockLot.findFirst({ where: { tenantId, skuId: item.skuId, lotCode } });
    if (existing) return existing.id;

    const created = await tx.stockLot.create({
      data: {
        tenantId,
        skuId: item.skuId,
        lotCode,
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
      },
    });
    return created.id;
  }

  /**
   * Custo médio ponderado do SKU.
   *
   * Com saldo zerado ou negativo não há média a ponderar — o custo da entrada
   * passa a ser o custo, senão o negativo puxaria a média para um número sem
   * sentido, às vezes negativo.
   */
  private async updateAverageCost(
    tx: TransactionClient,
    tenantId: string,
    item: ReceiptItem,
  ): Promise<void> {
    const sku = await tx.sku.findFirst({
      where: { id: item.skuId, tenantId },
      select: { avgCostCents: true },
    });
    if (!sku) {
      throw new ConflictError('SKU_NOT_FOUND', 'Produto não encontrado', { skuId: item.skuId });
    }

    // Saldo depois da entrada, somando todas as lojas: o custo é do produto,
    // não da prateleira.
    const totals = await tx.stockBalance.aggregate({
      where: { tenantId, skuId: item.skuId },
      _sum: { quantity: true },
    });
    const after = Number(totals._sum.quantity ?? 0);
    const before = round4(after - item.quantity);

    const average = weightedAverageCost({
      quantityBefore: before,
      averageCostCentsBefore: Number(sku.avgCostCents),
      quantityIn: item.quantity,
      unitCostCentsIn: item.unitCostCents,
    });

    await tx.sku.update({ where: { id: item.skuId }, data: { avgCostCents: BigInt(average) } });
  }

  private async loadBalances(
    tx: TransactionClient,
    tenantId: string,
    storeId: string,
    skuId: string,
  ): Promise<LotBalance[]> {
    const rows = await tx.stockBalance.findMany({
      where: { tenantId, storeId, skuId },
      include: { lot: true },
    });
    if (rows.length === 0) return [{ lotId: null, quantity: 0, expiresAt: null }];

    return rows.map((row) => ({
      lotId: row.lotId,
      quantity: Number(row.quantity),
      expiresAt: row.lot?.expiresAt ?? null,
    }));
  }

  private async applyMovement(
    tx: TransactionClient,
    movement: {
      tenantId: string;
      storeId: string;
      skuId: string;
      lotId: string | null;
      quantity: number;
      unitCostCents: bigint;
      kind: string;
      refType: string | null;
      refId: string | null;
      reason?: string;
      userId: string;
      occurredAt: Date;
    },
  ): Promise<void> {
    await tx.stockMovement.create({
      data: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
        kind: movement.kind,
        quantity: new Prisma.Decimal(movement.quantity),
        unitCostCents: movement.unitCostCents,
        refType: movement.refType,
        refId: movement.refId,
        reason: movement.reason,
        userId: movement.userId,
        occurredAt: movement.occurredAt,
      },
    });

    const balance = await tx.stockBalance.findFirst({
      where: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
      },
    });

    if (balance) {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { increment: new Prisma.Decimal(movement.quantity) } },
      });
      return;
    }

    await tx.stockBalance.create({
      data: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
        quantity: new Prisma.Decimal(movement.quantity),
      },
    });
  }
}

/** Quantidade é Decimal(14,4) no banco; arredondar evita ruído de ponto flutuante. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
