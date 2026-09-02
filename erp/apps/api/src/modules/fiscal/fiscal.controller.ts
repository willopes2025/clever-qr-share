import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Ctx, RequiresFeature, RequiresPermission } from '../../common/auth/decorators';
import type { RequestContext } from '../../common/tenancy/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FiscalService } from './fiscal.service';

@Controller('fiscal')
@RequiresFeature('fiscal')
export class FiscalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscal: FiscalService,
  ) {}

  /** Painel fiscal: o que autorizou, o que travou e o que precisa de correção. */
  @Get('documents')
  @RequiresPermission('fiscal.view')
  async list(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    const documents = await this.prisma.fiscalDocument.findMany({
      where: { tenantId: ctx.tenantId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { store: { select: { name: true } } },
    });

    return documents.map((document) => ({
      id: document.id,
      store: document.store.name,
      status: document.status,
      number: document.number ? Number(document.number) : null,
      accessKey: document.accessKey,
      rejection: document.rejectionCode
        ? { code: document.rejectionCode, message: document.rejectionMsg }
        : null,
      attempts: document.attempts,
      createdAt: document.createdAt,
      authorizedAt: document.authorizedAt,
    }));
  }

  @Get('summary')
  @RequiresPermission('fiscal.view')
  async summary(@Ctx() ctx: RequestContext) {
    const grouped = await this.prisma.fiscalDocument.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenantId },
      _count: true,
    });
    return Object.fromEntries(grouped.map((row) => [row.status, row._count]));
  }

  /**
   * Cancelamento. A SEFAZ aceita até 30 minutos depois da autorização da NFC-e,
   * e exige justificativa de no mínimo 15 caracteres — o texto vai para o
   * evento e fica no histórico do documento.
   */
  @Post('documents/:id/cancel')
  @RequiresPermission('fiscal.cancel')
  async cancel(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const reason = (body?.reason ?? '').trim();
    if (reason.length < 15) {
      throw new BadRequestException('A justificativa precisa de ao menos 15 caracteres');
    }
    await this.fiscal.cancel(ctx.tenantId, id, reason);
    return { status: 'cancelled' };
  }

  /** Botão da fila de correção: cadastro arrumado, manda de novo. */
  @Post('documents/:id/retry')
  @RequiresPermission('fiscal.retry')
  async retry(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    await this.fiscal.retry(ctx.tenantId, id);
    return { status: 'queued' };
  }
}
