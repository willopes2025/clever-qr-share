import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  cashMovementSchema,
  closeCashSessionSchema,
  openCashSessionSchema,
  syncSalesRequestSchema,
  type CashMovementInput,
  type CloseCashSessionInput,
  type OpenCashSessionInput,
  type SyncSalesRequest,
} from '@soul/contracts';
import { Ctx, RequiresPermission } from '../../common/auth/decorators';
import { DomainError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { BootstrapService } from './bootstrap.service';
import { CashSessionService } from './cash-session.service';
import { SyncService } from './sync.service';

@Controller('pos')
export class PosController {
  constructor(
    private readonly bootstrap: BootstrapService,
    private readonly cashSessions: CashSessionService,
    private readonly sync: SyncService,
  ) {}

  /** Pacote inicial do PDV: catálogo, operadores, plano e caixa em aberto. */
  @Get('bootstrap')
  load(@Ctx() ctx: RequestContext) {
    return this.bootstrap.load(ctx.tenantId, requireTerminal(ctx));
  }

  @Post('cash-sessions')
  @RequiresPermission('cash.open')
  open(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(openCashSessionSchema)) body: OpenCashSessionInput,
    @Query('operatorId') operatorId: string,
  ) {
    return this.cashSessions.open(sessionContext(ctx, operatorId), body.openingFloatCents);
  }

  @Get('cash-sessions/current')
  current(@Ctx() ctx: RequestContext) {
    return this.cashSessions.current(ctx.tenantId, requireTerminal(ctx));
  }

  @Post('cash-sessions/:id/movements')
  movement(
    @Ctx() ctx: RequestContext,
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(cashMovementSchema)) body: CashMovementInput,
    @Query('operatorId') operatorId: string,
  ) {
    return this.cashSessions.addMovement(sessionContext(ctx, operatorId), sessionId, body);
  }

  @Post('cash-sessions/:id/close')
  close(
    @Ctx() ctx: RequestContext,
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(closeCashSessionSchema)) body: CloseCashSessionInput,
    @Query('operatorId') operatorId: string,
    @Query('pendingSales') pendingSales = '0',
  ) {
    return this.cashSessions.close(
      sessionContext(ctx, operatorId),
      sessionId,
      body,
      Number(pendingSales),
    );
  }
}

@Controller('sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly bootstrap: BootstrapService,
  ) {}

  /** Recebe o lote de vendas acumulado pelo PDV. Idempotente por id de venda. */
  @Post('sales')
  async sales(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(syncSalesRequestSchema)) body: SyncSalesRequest,
  ) {
    const terminalId = requireTerminal(ctx);
    if (body.terminalId !== terminalId) {
      throw new DomainError('TERMINAL_MISMATCH', 'Lote enviado por outro terminal', {}, 403);
    }

    const { terminal, store } = await this.bootstrap.load(ctx.tenantId, terminalId);
    return this.sync.ingest(
      {
        tenantId: ctx.tenantId,
        storeId: store.id,
        terminalId: terminal.id,
        fiscalSeries: terminal.fiscalSeries,
      },
      body.sales,
    );
  }
}

function requireTerminal(ctx: RequestContext): string {
  if (!ctx.terminalId) {
    throw new DomainError('TERMINAL_SESSION_REQUIRED', 'Esta rota exige sessão de terminal', {}, 403);
  }
  return ctx.terminalId;
}

function sessionContext(ctx: RequestContext, operatorId: string) {
  if (!operatorId) {
    throw new DomainError('OPERATOR_REQUIRED', 'Informe o operador responsável', {}, 400);
  }
  return {
    tenantId: ctx.tenantId,
    storeId: ctx.storeId!,
    terminalId: requireTerminal(ctx),
    userId: operatorId,
  };
}
