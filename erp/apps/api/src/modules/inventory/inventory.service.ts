import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { allocateAvailable, type LotBalance } from './fefo';

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
