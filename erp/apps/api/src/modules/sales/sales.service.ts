import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';
import { DomainEventBus } from '../../common/events/domain-events';
import { InventoryService } from '../inventory/inventory.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { businessDayRange } from '../../common/time/business-time';

/**
 * Consulta e cancelamento de vendas.
 *
 * Existia o agregado — faturamento, curva, mix — e nenhuma forma de olhar uma
 * venda. Cliente pedindo segunda via, contador perguntando de um cupom,
 * operador que registrou o item errado: tudo isso é uma venda específica, e
 * até aqui não havia por onde chegar nela.
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly fiscal: FiscalService,
    private readonly events: DomainEventBus,
  ) {}

  /** Vendas de um dia, na loja. O padrão é hoje, que é o que se olha o tempo todo. */
  async list(
    tenantIds: string[],
    filters: { storeId?: string; date?: string; search?: string; limit?: number },
  ) {
    const reference = filters.date ? new Date(`${filters.date}T12:00:00Z`) : new Date();
    const { start, end } = businessDayRange(reference);
    const search = filters.search?.trim();

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId: { in: tenantIds },
        ...(filters.storeId ? { storeId: filters.storeId } : {}),
        occurredAt: { gte: start, lt: end },
        // Busca por número é o que o operador tem em mãos: está no cupom.
        ...(search && /^\d+$/.test(search) ? { number: BigInt(search) } : {}),
        ...(search && !/^\d+$/.test(search) ? { customerDocument: { contains: search } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(filters.limit ?? 200, 500),
      include: {
        store: { select: { name: true } },
        terminal: { select: { code: true } },
        payments: { select: { method: true, amountCents: true } },
        documents: { select: { status: true, number: true, accessKey: true }, take: 1 },
      },
    });

    return sales.map((sale) => ({
      id: sale.id,
      number: Number(sale.number),
      storeName: sale.store.name,
      terminalCode: sale.terminal?.code ?? null,
      status: sale.status,
      totalCents: Number(sale.totalCents),
      occurredAt: sale.occurredAt.toISOString(),
      methods: sale.payments.map((payment) => payment.method),
      fiscal: sale.documents[0]
        ? {
            status: sale.documents[0].status,
            number: sale.documents[0].number ? Number(sale.documents[0].number) : null,
            accessKey: sale.documents[0].accessKey,
          }
        : null,
    }));
  }

  /** Uma venda inteira: é o que vira segunda via e o que o contador confere. */
  async detail(tenantIds: string[], saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId: { in: tenantIds } },
      include: {
        store: { select: { name: true, code: true } },
        terminal: { select: { code: true } },
        operator: { select: { name: true } },
        items: { orderBy: { lineNumber: 'asc' } },
        payments: true,
        documents: { take: 1 },
      },
    });
    if (!sale) throw new NotFoundError('Venda', saleId);

    return {
      id: sale.id,
      number: Number(sale.number),
      status: sale.status,
      storeName: sale.store.name,
      terminalCode: sale.terminal?.code ?? null,
      operatorName: sale.operator?.name ?? null,
      customerDocument: sale.customerDocument,
      occurredAt: sale.occurredAt.toISOString(),
      grossCents: Number(sale.grossCents),
      discountCents: Number(sale.discountCents),
      totalCents: Number(sale.totalCents),
      items: sale.items.map((item) => ({
        lineNumber: item.lineNumber,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPriceCents: Number(item.unitPriceCents),
        discountCents: Number(item.discountCents),
        totalCents: Number(item.totalCents),
      })),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amountCents: Number(payment.amountCents),
        changeCents: Number(payment.changeCents),
        cardBrand: payment.cardBrand,
        installments: payment.installments,
      })),
      fiscal: sale.documents[0]
        ? {
            id: sale.documents[0].id,
            status: sale.documents[0].status,
            number: sale.documents[0].number ? Number(sale.documents[0].number) : null,
            accessKey: sale.documents[0].accessKey,
            qrCode: sale.documents[0].qrCode,
            danfeUrl: sale.documents[0].danfeUrl,
            rejectionMsg: sale.documents[0].rejectionMsg,
          }
        : null,
    };
  }

  /**
   * Cancela uma venda inteira.
   *
   * Três coisas precisam andar juntas, senão sobra divergência que ninguém
   * explica depois: o estoque volta, a nota é cancelada e a venda sai do
   * faturamento. O caixa se acerta sozinho — o fechamento e o painel já contam
   * só o que está `completed`.
   *
   * A nota é cancelada primeiro. Se a SEFAZ recusar — passou dos 30 minutos da
   * NFC-e, por exemplo — nada é desfeito, porque cancelar a venda deixando a
   * nota viva criaria uma nota sem venda, que é problema fiscal, não de
   * sistema.
   */
  async cancel(
    tenantId: string,
    saleId: string,
    input: { reason: string; userId: string },
  ): Promise<{ status: string; fiscalCancelled: boolean }> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, documents: { take: 1 } },
    });
    if (!sale) throw new NotFoundError('Venda', saleId);
    if (sale.status !== 'completed') {
      throw new ConflictError('SALE_NOT_CANCELLABLE', 'Esta venda já não está ativa', {
        status: sale.status,
      });
    }

    const document = sale.documents[0];
    let fiscalCancelled = false;

    if (document && document.status === 'authorized') {
      // Deixa estourar: nota viva sem venda é pior do que a venda seguir ativa.
      await this.fiscal.cancel(tenantId, document.id, input.reason);
      fiscalCancelled = true;
    } else if (document && document.status !== 'cancelled') {
      // Ainda não autorizou: tirar da fila evita emitir nota de venda cancelada.
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: {
          status: 'cancelled',
          nextAttemptAt: null,
          rejectionMsg: `Venda cancelada: ${input.reason}`,
        },
      });
      fiscalCancelled = true;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.returnToStock(tx, {
        tenantId,
        storeId: sale.storeId,
        saleId: sale.id,
        originalSaleId: sale.id,
        userId: input.userId,
        occurredAt: new Date(),
        items: sale.items.map((item) => ({
          skuId: item.skuId,
          quantity: Number(item.quantity),
          unitCostCents: item.unitCostCents,
        })),
      });

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'cancelled', cancelReason: input.reason, cancelledAt: new Date() },
      });
    });

    this.logger.warn(`Venda ${sale.number} cancelada por ${input.userId}: ${input.reason}`);
    await this.events.emit('sale.cancelled', {
      tenantId,
      storeId: sale.storeId,
      saleId: sale.id,
      reason: input.reason,
    });

    return { status: 'cancelled', fiscalCancelled };
  }
}
