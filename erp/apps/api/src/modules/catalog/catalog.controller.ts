import { Controller, Get, Param, Query } from '@nestjs/common';
import { Ctx } from '../../common/auth/decorators';
import type { RequestContext } from '../../common/tenancy/request-context';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Query('storeId') storeId?: string) {
    return this.catalog.listForStore(ctx.tenantId, storeId ?? requireStore(ctx));
  }

  @Get('barcode/:code')
  lookup(@Ctx() ctx: RequestContext, @Param('code') code: string, @Query('storeId') storeId?: string) {
    return this.catalog.lookupBarcode(ctx.tenantId, storeId ?? requireStore(ctx), code);
  }
}

function requireStore(ctx: RequestContext): string {
  if (!ctx.storeId) throw new Error('storeId é obrigatório para sessões que não são de terminal');
  return ctx.storeId;
}
