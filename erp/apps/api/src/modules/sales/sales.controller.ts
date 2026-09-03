import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { SalesService } from './sales.service';

const cancelSchema = z.object({
  // Motivo curto demais não explica nada a quem for auditar meses depois.
  reason: z.string().min(5, 'descreva o motivo do cancelamento').max(240),
});

type CancelBody = z.infer<typeof cancelSchema>;

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /** Vendas do dia. Consolida o grupo econômico quando existe. */
  @Get()
  @RequiresPermission('report.view')
  list(
    @Ctx() ctx: RequestContext,
    @Query('storeId') storeId?: string,
    @Query('date') date?: string,
    @Query('search') search?: string,
  ) {
    return this.sales.list(ctx.tenantIds, { storeId, date, search });
  }

  /** Uma venda inteira: vira segunda via e é o que o contador confere. */
  @Get(':id')
  @RequiresPermission('report.view')
  detail(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.sales.detail(ctx.tenantIds, id);
  }

  /**
   * Cancela a venda: estoque volta, nota é cancelada, faturamento sai.
   *
   * Fica na retaguarda de propósito. O token do terminal carrega permissão
   * fixa, então um botão no PDV valeria para qualquer operador — e cancelamento
   * livre no balcão é por onde o dinheiro sai andando. Enquanto não houver
   * autorização por PIN de supervisor, quem cancela é quem tem login.
   */
  @Post(':id/cancel')
  @RequiresPermission('sale.cancel')
  cancel(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelSchema)) body: CancelBody,
  ) {
    return this.sales.cancel(ctx.tenantId, id, {
      reason: body.reason,
      userId: ctx.userId ?? 'sistema',
    });
  }
}
