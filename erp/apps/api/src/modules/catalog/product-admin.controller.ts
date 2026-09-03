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
  // Unidade do estoque. O padrão é a unidade porque a maioria vende peça, mas
  // insumo pesado ou líquido precisa da sua: KG para o granel, L para a calda.
  unit: z.enum(['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PC']).optional(),
  priceCents: z.number().int().positive(),
  barcode: z.string().regex(/^\d{8,14}$/, 'código de barras deve ter de 8 a 14 dígitos').nullish(),
  active: z.boolean().optional(),
});

const productSchema = z.object({
  name: z.string().min(2).max(120),
  categoryId: z.string().uuid().nullish(),
  ncm: z.string().regex(/^\d{8}$/, 'NCM tem 8 dígitos').nullish(),
  // Aceita com ou sem pontuação (23.001.00 ou 2300100): é assim que o CEST
  // aparece na tabela do CONFAZ e na nota do fornecedor.
  cest: z
    .string()
    .regex(/^\d{2}\.?\d{3}\.?\d{2}$/, 'CEST tem 7 dígitos (ex.: 23.001.00)')
    .nullish(),
  cfop: z.string().regex(/^\d{4}$/).nullish(),
  origin: z.number().int().min(0).max(8).nullish(),
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
