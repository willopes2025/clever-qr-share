import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { InventoryService } from './inventory.service';

const quantidade = z.number().positive().max(1_000_000);

const receiveSchema = z.object({
  storeId: z.string().uuid(),
  document: z.string().max(60).nullish(),
  items: z
    .array(
      z.object({
        skuId: z.string().uuid(),
        quantity: quantidade,
        unitCostCents: z.number().int().min(0),
        lotCode: z.string().max(40).nullish(),
        // Data só, sem hora: validade de pote é dia, não instante.
        expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validade no formato AAAA-MM-DD').nullish(),
      }),
    )
    .min(1, 'a entrada precisa de ao menos um item')
    .max(200),
});

const countSchema = z.object({
  storeId: z.string().uuid(),
  reason: z.string().min(3).max(120),
  items: z
    .array(z.object({ skuId: z.string().uuid(), countedQuantity: z.number().min(0).max(1_000_000) }))
    .min(1, 'a contagem precisa de ao menos um item')
    .max(500),
});

type ReceiveBody = z.infer<typeof receiveSchema>;
type CountBody = z.infer<typeof countSchema>;

/**
 * Estoque.
 *
 * A baixa pela venda já existia; o que faltava era tudo o que faz o saldo
 * subir e o que faz ele bater com a prateleira. Sem estas rotas o número de
 * estoque de qualquer loja vira ficção depois da primeira venda.
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Saldo da loja: negativo primeiro, depois o que furou o mínimo. */
  @Get('balances')
  @RequiresPermission('stock.adjust')
  balances(
    @Ctx() ctx: RequestContext,
    @Query('storeId') storeId: string,
    @Query('search') search?: string,
  ) {
    return this.inventory.balances(ctx.tenantId, storeId, search?.trim() || undefined);
  }

  /** Extrato de um produto: de onde veio e para onde foi cada unidade. */
  @Get('movements')
  @RequiresPermission('stock.adjust')
  movements(
    @Ctx() ctx: RequestContext,
    @Query('storeId') storeId: string,
    @Query('skuId') skuId: string,
  ) {
    return this.inventory.movements(ctx.tenantId, storeId, skuId);
  }

  /** Recebimento de mercadoria. Atualiza o custo médio junto. */
  @Post('receipts')
  @RequiresPermission('stock.adjust')
  receive(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(receiveSchema)) body: ReceiveBody) {
    return this.inventory.receive({
      tenantId: ctx.tenantId,
      storeId: body.storeId,
      userId: ctx.userId ?? 'sistema',
      document: body.document ?? null,
      items: body.items,
    });
  }

  /** Contagem: devolve o que estava errado, que é o dado que interessa. */
  @Post('counts')
  @RequiresPermission('stock.adjust')
  async count(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(countSchema)) body: CountBody) {
    const differences = await this.inventory.count({
      tenantId: ctx.tenantId,
      storeId: body.storeId,
      userId: ctx.userId ?? 'sistema',
      reason: body.reason,
      items: body.items,
    });
    return { checked: body.items.length, differences };
  }
}
