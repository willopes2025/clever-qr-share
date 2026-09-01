import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SaleInput, SyncSaleRejection, SyncSaleResult, SyncSalesResponse } from '@soul/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-events';
import { DomainError } from '../../common/errors/domain-error';
import { InventoryService } from '../inventory/inventory.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { UsageService } from '../tenancy/usage.service';

export interface SyncContext {
  tenantId: string;
  storeId: string;
  terminalId: string;
  fiscalSeries: number;
}

/**
 * Recebimento das vendas que o PDV acumulou.
 *
 * Duas garantias sustentam o modo offline:
 *   1. o id da venda nasce no PDV, então reenviar o mesmo lote não duplica nada;
 *   2. uma venda ruim não derruba o lote — ela é recusada sozinha, com a ação
 *      que o PDV deve tomar (tentar de novo, pôr de quarentena ou descartar).
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly fiscal: FiscalService,
    private readonly usage: UsageService,
    private readonly events: DomainEventBus,
  ) {}

  async ingest(context: SyncContext, sales: SaleInput[]): Promise<SyncSalesResponse> {
    const results: SyncSaleResult[] = [];
    const rejected: SyncSaleRejection[] = [];

    for (const sale of sales) {
      try {
        results.push(await this.ingestOne(context, sale));
      } catch (error) {
        rejected.push(this.describeRejection(sale.id, error));
      }
    }

    return { results, rejected };
  }

  private async ingestOne(context: SyncContext, sale: SaleInput): Promise<SyncSaleResult> {
    const existing = await this.prisma.sale.findUnique({
      where: { id: sale.id },
      include: { documents: { select: { id: true, status: true }, take: 1 } },
    });

    // Reenvio do mesmo lote: devolve o resultado anterior em vez de gravar de novo.
    if (existing) {
      return {
        id: existing.id,
        status: 'duplicate',
        number: Number(existing.number),
        fiscal: {
          status: existing.documents[0]?.status ?? 'none',
          documentId: existing.documents[0]?.id ?? null,
        },
      };
    }

    const receivedAt = new Date();
    const occurredAt = new Date(sale.occurredAt);

    const { number, documentId } = await this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findFirst({
        where: { id: sale.sessionId, tenantId: context.tenantId },
      });
      if (!session) throw new DomainError('CASH_SESSION_NOT_FOUND', 'Sessão de caixa inexistente', { id: sale.sessionId });

      const nextNumber = await this.nextSaleNumber(tx, context.tenantId, context.storeId);
      const costByItem = await this.loadCosts(tx, sale);

      await tx.sale.create({
        data: {
          id: sale.id,
          tenantId: context.tenantId,
          storeId: context.storeId,
          terminalId: context.terminalId,
          sessionId: sale.sessionId,
          number: nextNumber,
          customerDocument: sale.customerDocument ?? null,
          operatorId: sale.operatorId,
          grossCents: BigInt(sale.grossCents),
          discountCents: BigInt(sale.discountCents),
          totalCents: BigInt(sale.totalCents),
          // Custo congelado no momento da venda, para a margem histórica não mudar
          // quando o custo médio do SKU for atualizado depois.
          costCents: totalCostCents(sale, costByItem),
          channel: sale.channel,
          occurredAt,
          receivedAt,
          // Relógio do PDV não é confiável: guardamos a deriva em vez de acreditar nele.
          clockSkewMs: receivedAt.getTime() - occurredAt.getTime(),
          items: {
            create: sale.items.map((item) => ({
              tenantId: context.tenantId,
              lineNumber: item.lineNumber,
              skuId: item.skuId,
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unit: item.unit,
              unitPriceCents: BigInt(item.unitPriceCents),
              discountCents: BigInt(item.discountCents),
              totalCents: BigInt(item.totalCents),
              unitCostCents: costByItem.get(item.skuId) ?? 0n,
              weighed: item.weighed,
            })),
          },
          payments: {
            create: sale.payments.map((payment) => ({
              tenantId: context.tenantId,
              method: payment.method,
              amountCents: BigInt(payment.amountCents),
              changeCents: BigInt(payment.changeCents),
              captured: payment.captured,
              acquirer: payment.acquirer ?? null,
              cardBrand: payment.cardBrand ?? null,
              installments: payment.installments,
              nsu: payment.nsu ?? null,
              authorizationCode: payment.authorizationCode ?? null,
            })),
          },
        },
      });

      await this.inventory.consumeForSale(tx, {
        tenantId: context.tenantId,
        storeId: context.storeId,
        saleId: sale.id,
        userId: sale.operatorId,
        occurredAt,
        items: sale.items.map((item) => ({
          skuId: item.skuId,
          quantity: Number(item.quantity),
          unitCostCents: costByItem.get(item.skuId) ?? 0n,
        })),
      });

      const fiscalDocumentId = await this.fiscal.enqueueForSale(tx as never, {
        tenantId: context.tenantId,
        storeId: context.storeId,
        saleId: sale.id,
        series: context.fiscalSeries,
      });

      return { number: nextNumber, documentId: fiscalDocumentId };
    });

    await this.usage.increment(context.tenantId, 'sales');
    await this.events.emit('sale.finalized', {
      tenantId: context.tenantId,
      storeId: context.storeId,
      terminalId: context.terminalId,
      saleId: sale.id,
      totalCents: BigInt(sale.totalCents),
      occurredAt,
    });

    return {
      id: sale.id,
      status: 'accepted',
      number: Number(number),
      fiscal: { status: 'queued', documentId },
    };
  }

  /**
   * Numeração sequencial por loja é atribuída pelo servidor — o PDV offline não
   * tem como saber qual foi a última. O lock consultivo por (tenant, loja) evita
   * que dois terminais da mesma loja peguem o mesmo número ao sincronizar juntos.
   */
  private async nextSaleNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    storeId: string,
  ): Promise<bigint> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${storeId}`}))`;

    const last = await tx.sale.aggregate({
      where: { tenantId, storeId },
      _max: { number: true },
    });
    return (last._max.number ?? 0n) + 1n;
  }

  private async loadCosts(tx: Prisma.TransactionClient, sale: SaleInput): Promise<Map<string, bigint>> {
    const skus = await tx.sku.findMany({
      where: { id: { in: sale.items.map((item) => item.skuId) } },
      select: { id: true, avgCostCents: true },
    });
    if (skus.length !== new Set(sale.items.map((item) => item.skuId)).size) {
      throw new DomainError('SKU_NOT_FOUND', 'Item da venda não existe no catálogo deste cliente');
    }
    return new Map(skus.map((sku) => [sku.id, sku.avgCostCents]));
  }

  private describeRejection(saleId: string, error: unknown): SyncSaleRejection {
    if (error instanceof DomainError) {
      // Erro de negócio não se resolve tentando de novo: vai para a tela de pendências.
      return { id: saleId, code: error.code, message: error.message, action: 'quarantine' };
    }
    this.logger.error(`Erro inesperado ao gravar venda ${saleId}: ${(error as Error).message}`);
    return {
      id: saleId,
      code: 'INTERNAL_ERROR',
      message: 'Falha temporária ao gravar a venda',
      action: 'retry',
    };
  }
}

/** Custo total da venda, respeitando quantidade fracionada de item por peso. */
function totalCostCents(sale: SaleInput, costByItem: Map<string, bigint>): bigint {
  return sale.items.reduce((total, item) => {
    const unitCost = Number(costByItem.get(item.skuId) ?? 0n);
    return total + BigInt(Math.round(unitCost * Number(item.quantity)));
  }, 0n);
}
