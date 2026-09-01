import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { UserAdminService } from './user-admin.service';

const userSchema = z
  .object({
    name: z.string().min(2).max(80),
    email: z.string().email().nullish(),
    password: z.string().min(8, 'a senha precisa de 8 caracteres').nullish(),
    pin: z.string().regex(/^\d{4,6}$/, 'o PIN tem de 4 a 6 dígitos').nullish(),
    roleCode: z.string().min(2),
    storeId: z.string().uuid().nullish(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((user) => user.email || user.pin, {
    message: 'informe e-mail para a retaguarda ou PIN para o caixa',
    path: ['pin'],
  });

@Controller('users')
export class UserAdminController {
  constructor(private readonly users: UserAdminService) {}

  @Get()
  @RequiresPermission('user.manage')
  list(@Ctx() ctx: RequestContext) {
    return this.users.list(ctx.tenantId);
  }

  @Get('roles')
  @RequiresPermission('user.manage')
  roles(@Ctx() ctx: RequestContext) {
    return this.users.roles(ctx.tenantId);
  }

  @Post()
  @RequiresPermission('user.manage')
  create(@Ctx() ctx: RequestContext, @Body(new ZodValidationPipe(userSchema)) body: z.infer<typeof userSchema>) {
    return this.users.create(ctx.tenantId, body);
  }

  @Put(':id')
  @RequiresPermission('user.manage')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(userSchema)) body: z.infer<typeof userSchema>,
  ) {
    return this.users.update(ctx.tenantId, id, body);
  }
}
