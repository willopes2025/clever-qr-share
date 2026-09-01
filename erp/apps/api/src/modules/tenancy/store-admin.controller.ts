import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { StoreAdminService } from './store-admin.service';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'horário no formato HH:MM').nullish();

const storeSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(2).max(80),
  kind: z.enum(['kiosk', 'store', 'container', 'warehouse']).optional(),
  opensAt: timeSchema,
  closesAt: timeSchema,
  active: z.boolean().optional(),
});

const terminalSchema = z.object({ code: z.string().min(1).max(10) });

@Controller('stores')
export class StoreAdminController {
  constructor(private readonly stores: StoreAdminService) {}

  @Get()
  @RequiresPermission('store.manage')
  list(@Ctx() ctx: RequestContext) {
    return this.stores.list(ctx.tenantId);
  }

  @Post()
  @RequiresPermission('store.manage')
  create(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(storeSchema)) body: z.infer<typeof storeSchema>) {
    return this.stores.createStore(ctx.tenantId, body);
  }

  @Put(':id')
  @RequiresPermission('store.manage')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(storeSchema)) body: z.infer<typeof storeSchema>,
  ) {
    return this.stores.updateStore(ctx.tenantId, id, body);
  }

  /** Devolve o código de ativação uma única vez, para digitar no PDV. */
  @Post(':id/terminals')
  @RequiresPermission('store.manage')
  createTerminal(
    @Ctx() ctx: RequestContext,
    @Param('id') storeId: string,
    @Body(new ZodValidationPipe(terminalSchema)) body: z.infer<typeof terminalSchema>,
  ) {
    return this.stores.createTerminal(ctx.tenantId, storeId, body.code);
  }

  @Post('terminals/:terminalId/activation')
  @RequiresPermission('store.manage')
  regenerate(@Ctx() ctx: RequestContext, @Param('terminalId') terminalId: string) {
    return this.stores.regenerateActivation(ctx.tenantId, terminalId);
  }

  @Post('terminals/:terminalId/disable')
  @RequiresPermission('store.manage')
  disable(@Ctx() ctx: RequestContext, @Param('terminalId') terminalId: string) {
    return this.stores.setTerminalStatus(ctx.tenantId, terminalId, 'disabled');
  }
}
