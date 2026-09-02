import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-events';
import { UsageService } from '../tenancy/usage.service';
import {
  FISCAL_PROVIDER,
  type FiscalIssueInput,
  type FiscalIssueResult,
  type FiscalProvider,
} from './fiscal-provider';
import { isRetryable, nextAttemptAt } from './retry-policy';
import { parseTaxProfileRules, resolveItemTax } from './tax-rules';

const NFCE_MODEL = 65 as const;

/**
 * Um SKU pode ter vários códigos de barras (etiqueta de balança, código
 * interno). Só o EAN vale como GTIN na nota — os outros a SEFAZ recusa.
 */
function pickGtin(barcodes: Array<{ code: string; kind: string }> | undefined): string | null {
  const ean = barcodes?.find((barcode) => barcode.kind === 'ean');
  return ean?.code ?? null;
}

/**
 * Emissão fiscal assíncrona.
 *
 * A venda entra na fila e o caixa segue vendendo. Um trabalhador processa a
 * fila em segundo plano, com retentativa — indisponibilidade do gateway nunca
 * vira fila de gente esperando no quiosque.
 */
@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);
  private readonly environment = Number(process.env.FISCAL_ENVIRONMENT ?? 2) as 1 | 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly usage: UsageService,
    @Inject(FISCAL_PROVIDER) private readonly provider: FiscalProvider,
  ) {}

  /** Cria o documento em `queued`. Chamado na mesma transação da venda. */
  async enqueueForSale(tx: {
    fiscalDocument: { create: (args: unknown) => Promise<{ id: string }> };
  }, input: {
    tenantId: string;
    storeId: string;
    saleId: string;
    series: number;
  }): Promise<string> {
    const document = await tx.fiscalDocument.create({
      data: {
        tenantId: input.tenantId,
        storeId: input.storeId,
        saleId: input.saleId,
        model: NFCE_MODEL,
        series: input.series,
        status: 'queued',
        provider: this.provider.name,
        environment: this.environment,
        nextAttemptAt: new Date(),
        payload: {},
      },
      select: { id: true },
    } as never);
    return document.id;
  }

  /** Roda a fila. Em produção este gatilho vira um worker separado da API. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    const pending = await this.prisma.fiscalDocument.findMany({
      where: { status: 'queued', nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const document of pending) {
      await this.processOne(document.id).catch((error) =>
        this.logger.error(`Falha ao processar documento ${document.id}: ${(error as Error).message}`),
      );
    }
  }

  async processOne(documentId: string): Promise<void> {
    const document = await this.prisma.fiscalDocument.findUnique({
      where: { id: documentId },
      include: {
        store: { include: { tenant: true } },
        sale: {
          include: {
            items: {
              include: {
                sku: { include: { product: { include: { taxProfile: true } }, barcodes: true } },
              },
            },
            payments: true,
          },
        },
      },
    });
    if (!document?.sale) return;

    await this.prisma.fiscalDocument.update({
      where: { id: documentId },
      data: { status: 'sending', attempts: { increment: 1 } },
    });

    const input = this.buildIssueInput(document);
    const result = await this.provider.issue(input);
    await this.applyProviderResult(documentId, result, input as unknown as object);
  }

  /**
   * Aplica o desfecho vindo do provedor. Serve tanto à fila quanto ao webhook —
   * o que chegar primeiro resolve, e o segundo encontra o documento já resolvido.
   */
  async applyProviderResult(
    documentId: string,
    result: FiscalIssueResult,
    payload?: object,
  ): Promise<void> {
    const document = await this.prisma.fiscalDocument.findUnique({ where: { id: documentId } });
    if (!document) return;
    if (document.status === 'authorized' || document.status === 'cancelled') return;

    if (result.status === 'authorized') {
      await this.prisma.fiscalDocument.update({
        where: { id: documentId },
        data: {
          status: 'authorized',
          providerRef: result.providerRef,
          accessKey: result.accessKey,
          number: result.number ? BigInt(result.number) : null,
          protocol: result.protocol,
          xmlUrl: result.xmlUrl,
          danfeUrl: result.danfeUrl,
          qrCode: result.qrCode,
          authorizedAt: new Date(),
          nextAttemptAt: null,
          ...(payload ? { payload: payload as never } : {}),
        },
      });
      await this.usage.increment(document.tenantId, 'invoices');
      await this.events.emit('fiscal.document.authorized', {
        tenantId: document.tenantId,
        documentId,
        saleId: document.saleId,
      });
      return;
    }

    if (result.status === 'processing') {
      await this.prisma.fiscalDocument.update({
        where: { id: documentId },
        data: {
          status: 'queued',
          providerRef: result.providerRef,
          nextAttemptAt: nextAttemptAt(document.attempts),
        },
      });
      return;
    }

    await this.handleRejection(documentId, document.tenantId, document.attempts, result.rejection);
  }

  private async handleRejection(
    documentId: string,
    tenantId: string,
    attempts: number,
    rejection?: { code: string; message: string; retryable: boolean },
  ): Promise<void> {
    const code = rejection?.code ?? 'UNKNOWN';
    const message = rejection?.message ?? 'Rejeição sem detalhe';
    const retryable = rejection?.retryable ?? isRetryable(code);
    const next = retryable ? nextAttemptAt(attempts) : null;

    await this.prisma.fiscalDocument.update({
      where: { id: documentId },
      data: {
        status: next ? 'queued' : 'rejected',
        rejectionCode: code,
        rejectionMsg: message,
        nextAttemptAt: next,
      },
    });

    if (!next) {
      this.logger.warn(`Documento ${documentId} rejeitado definitivamente: ${code} — ${message}`);
      await this.events.emit('fiscal.document.rejected', { tenantId, documentId, code, message });
    }
  }

  private buildIssueInput(document: any): FiscalIssueInput {
    const tenant = document.store.tenant;
    return {
      documentId: document.id,
      model: NFCE_MODEL,
      series: document.series,
      environment: document.environment as 1 | 2,
      issuer: {
        cnpj: tenant.cnpj,
        legalName: tenant.legalName,
        tradeName: tenant.tradeName,
        ie: tenant.ie,
        crt: tenant.crt,
        address: tenant.address,
      },
      customerDocument: document.sale.customerDocument,
      items: document.sale.items.map((item: any) => {
        const product = item.sku.product;
        return {
          lineNumber: item.lineNumber,
          code: item.sku.code,
          description: item.description,
          ncm: product.ncm,
          cest: product.cest,
          cfop: product.cfop,
          origin: product.origin ?? 0,
          gtin: pickGtin(item.sku.barcodes),
          unit: item.unit,
          quantity: Number(item.quantity),
          unitPriceCents: Number(item.unitPriceCents),
          totalCents: Number(item.totalCents),
          discountCents: Number(item.discountCents),
          // A tributação é resolvida aqui, com o cadastro em mãos, e viaja
          // pronta até o adaptador. Assim trocar de gateway não recomeça a
          // discussão de CSOSN.
          tax: resolveItemTax({
            crt: tenant.crt,
            cest: product.cest ?? null,
            cfop: product.cfop ?? null,
            rules: parseTaxProfileRules(product.taxProfile?.rules),
          }),
        };
      }),
      payments: document.sale.payments.map((payment: any) => ({
        method: payment.method,
        amountCents: Number(payment.amountCents),
        changeCents: Number(payment.changeCents ?? 0),
        cardBrand: payment.cardBrand ?? undefined,
        installments: payment.installments,
      })),
      totalCents: Number(document.sale.totalCents),
      discountCents: Number(document.sale.discountCents),
      occurredAt: document.sale.occurredAt,
    };
  }

  /** Cancela uma nota autorizada. A SEFAZ dá 30 minutos para NFC-e. */
  async cancel(tenantId: string, documentId: string, reason: string): Promise<void> {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) throw new NotFoundException('Documento fiscal não encontrado');
    if (document.status !== 'authorized') {
      throw new ConflictException('Só nota autorizada pode ser cancelada');
    }

    const result = await this.provider.cancel(document.providerRef ?? document.id, reason);
    if (result.status !== 'accepted') {
      throw new ConflictException(result.message ?? 'A SEFAZ recusou o cancelamento');
    }

    await this.prisma.fiscalDocument.update({
      where: { id: documentId },
      data: {
        status: 'cancelled',
        protocol: result.protocol ?? document.protocol,
        rejectionMsg: reason,
        nextAttemptAt: null,
      },
    });
    await this.events.emit('fiscal.document.cancelled', { tenantId, documentId, reason });
  }

  /**
   * Devolve à fila uma nota que parou em `rejeitada`. É o botão da tela de
   * correção: alguém arrumou o NCM ou o CSOSN e manda de novo. Zera as
   * tentativas, senão a nota corrigida herda a espera longa da anterior.
   */
  async retry(tenantId: string, documentId: string): Promise<void> {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) throw new NotFoundException('Documento fiscal não encontrado');
    if (document.status === 'authorized' || document.status === 'cancelled') {
      throw new ConflictException('Documento já resolvido');
    }

    await this.prisma.fiscalDocument.update({
      where: { id: documentId },
      data: {
        status: 'queued',
        attempts: 0,
        nextAttemptAt: new Date(),
        rejectionCode: null,
        rejectionMsg: null,
      },
    });
  }
}
