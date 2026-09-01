import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { ProductAdminService } from './product-admin.service';

const skuSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(20),
  description: z.string().min(2).max(120),
  priceCents: z.number().int().positive(),
  barcode: z.string().regex(/^\d{8,14}$/, 'código de barras deve ter de 8 a 14 dígitos').nullish(),
  active: z.boolean().optional(),
});

const productSchema = z.object({
  name: z.string().min(2).max(120),
  categoryId: z.string().uuid().nullish(),
  ncm: z.string().regex(/^\d{8}$/, 'NCM tem 8 dígitos').nullish(),
  cfop: z.string().regex(/^\d{4}$/).nullish(),
  active: z.boolean().optional(),
  skus: z.array(skuSchema).min(1, 'o produto precisa de ao menos uma variação'),
});

type ProductBody = z.infer<typeof productSchema>;

@Controller('products')
export class ProductAdminController {
  constructor(private readonly products: ProductAdminService) {}

  @Get()
  @RequiresPermission('product.manage')
  list(@Ctx() ctx: RequestContext, @Query('search') search?: string) {
    return this.products.list(ctx.tenantId, search);
  }

  @Get('categories')
  @RequiresPermission('product.manage')
  categories(@Ctx() ctx: RequestContext) {
    return this.products.categories(ctx.tenantId);
  }

  @Post()
  @RequiresPermission('product.manage')
  create(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(productSchema)) body: ProductBody) {
    return this.products.create(ctx.tenantId, body);
  }

  @Put(':id')
  @RequiresPermission('product.manage')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(productSchema)) body: ProductBody,
  ) {
    return this.products.update(ctx.tenantId, id, body);
  }
}
