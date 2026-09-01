import { Injectable } from '@nestjs/common';
import type { CashMovementInput, CloseCashSessionInput } from '@soul/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';
import { DomainEventBus } from '../../common/events/domain-events';
import { closeCashSession, type CashSessionSnapshot } from './cash-closing';

export interface CashSessionContext {
  tenantId: string;
  storeId: string;
  terminalId: string;
  userId: string;
}

@Injectable()
export class CashSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  async open(context: CashSessionContext, openingFloatCents: number) {
    const alreadyOpen = await this.prisma.cashSession.findFirst({
      where: { tenantId: context.tenantId, terminalId: context.terminalId, status: 'open' },
    });
    if (alreadyOpen) {
      throw new ConflictError('CASH_SESSION_ALREADY_OPEN', 'Já existe caixa aberto neste terminal', {
        sessionId: alreadyOpen.id,
      });
    }

    return this.prisma.cashSession.create({
      data: {
        tenantId: context.tenantId,
        storeId: context.storeId,
        terminalId: context.terminalId,
        openedById: context.userId,
        openedAt: new Date(),
        openingFloatCents: BigInt(openingFloatCents),
      },
    });
  }

  async current(tenantId: string, terminalId: string) {
    return this.prisma.cashSession.findFirst({
      where: { tenantId, terminalId, status: 'open' },
      include: { movements: true },
    });
  }

  async addMovement(context: CashSessionContext, sessionId: string, input: CashMovementInput) {
    const session = await this.requireOpenSession(context.tenantId, sessionId);

    return this.prisma.cashMovement.create({
      data: {
        tenantId: context.tenantId,
        sessionId: session.id,
        kind: input.kind,
        amountCents: BigInt(input.amountCents),
        reason: input.reason,
        userId: context.userId,
      },
    });
  }

  /**
   * Fecha o caixa com conferência cega. Recusa fechar enquanto houver venda que
   * o PDV ainda não conseguiu enviar — caixa fechado com venda pendente vira
   * diferença que ninguém consegue reconstituir depois.
   */
  async close(
    context: CashSessionContext,
    sessionId: string,
    input: CloseCashSessionInput,
    pendingSales = 0,
  ) {
    if (pendingSales > 0) {
      throw new ConflictError('PENDING_SALES', 'Existem vendas ainda não sincronizadas', { pendingSales });
    }

    const session = await this.requireOpenSession(context.tenantId, sessionId);
    const snapshot = await this.buildSnapshot(context.tenantId, sessionId, Number(session.openingFloatCents));
    const closing = closeCashSession(snapshot, input.counted);

    if (closing.requiresJustification && !input.notes?.trim()) {
      throw new ConflictError('JUSTIFICATION_REQUIRED', 'Diferença no caixa exige justificativa', {
        differenceCents: closing.differenceCents,
      });
    }

    const closed = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedById: context.userId,
        counted: closing.counted,
        expected: closing.expected,
        differenceCents: BigInt(closing.differenceCents),
        notes: input.notes,
      },
    });

    await this.events.emit('cash.session.closed', {
      tenantId: context.tenantId,
      sessionId,
      differenceCents: BigInt(closing.differenceCents),
    });

    return { session: closed, closing };
  }

  private async requireOpenSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundError('sessão de caixa', sessionId);
    if (session.status !== 'open') {
      throw new ConflictError('CASH_SESSION_CLOSED', 'Sessão de caixa já foi fechada');
    }
    return session;
  }

  private async buildSnapshot(
    tenantId: string,
    sessionId: string,
    openingFloatCents: number,
  ): Promise<CashSessionSnapshot> {
    const [payments, movements] = await Promise.all([
      this.prisma.salePayment.groupBy({
        by: ['method'],
        where: { tenantId, sale: { sessionId, status: 'completed' } },
        _sum: { amountCents: true, changeCents: true },
      }),
      this.prisma.cashMovement.groupBy({
        by: ['kind'],
        where: { tenantId, sessionId },
        _sum: { amountCents: true },
      }),
    ]);

    const salesByMethod: Record<string, number> = {};
    let changeGivenCents = 0;
    for (const row of payments) {
      salesByMethod[row.method] = Number(row._sum.amountCents ?? 0n);
      changeGivenCents += Number(row._sum.changeCents ?? 0n);
    }

    const byKind = (kind: string) =>
      Number(movements.find((movement) => movement.kind === kind)?._sum.amountCents ?? 0n);

    return {
      openingFloatCents,
      salesByMethod,
      withdrawalsCents: byKind('withdrawal'),
      suppliesCents: byKind('supply') + byKind('reinforcement'),
      changeGivenCents,
    };
  }
}
