import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';
import { EntitlementsService } from './entitlements.service';

export interface SaveStoreInput {
  code: string;
  name: string;
  kind?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  active?: boolean;
}

/**
 * Lojas e terminais.
 *
 * É aqui que nasce o código de ativação que o PDV usa para se parear — hoje o
 * único caminho para pôr um quiosque novo no ar sem mexer no banco.
 */
@Injectable()
export class StoreAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(tenantId: string) {
    const stores = await this.prisma.store.findMany({
      where: { tenantId },
      include: {
        terminals: { orderBy: { code: 'asc' } },
        _count: { select: { sales: true } },
      },
      orderBy: { code: 'asc' },
    });

    return stores.map((store) => ({
      id: store.id,
      code: store.code,
      name: store.name,
      kind: store.kind,
      opensAt: store.opensAt,
      closesAt: store.closesAt,
      active: store.active,
      salesCount: store._count.sales,
      terminals: store.terminals.map((terminal) => ({
        id: terminal.id,
        code: terminal.code,
        fiscalSeries: terminal.fiscalSeries,
        status: terminal.status,
        appVersion: terminal.appVersion,
        lastSeenAt: terminal.lastSeenAt,
        // O código de ativação nunca volta numa listagem: ele aparece uma vez,
        // quando é gerado, e depois só pode ser trocado por outro.
        paired: Boolean(terminal.lastSeenAt),
      })),
    }));
  }

  async createStore(tenantId: string, input: SaveStoreInput) {
    const count = await this.prisma.store.count({ where: { tenantId, active: true } });
    await this.entitlements.assertWithinLimit(tenantId, 'stores', count);

    const taken = await this.prisma.store.findFirst({ where: { tenantId, code: input.code } });
    if (taken) throw new ConflictError('STORE_CODE_IN_USE', 'Já existe uma loja com este código');

    return this.prisma.store.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        kind: input.kind ?? 'kiosk',
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
      },
    });
  }

  async updateStore(tenantId: string, storeId: string, input: SaveStoreInput) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, tenantId } });
    if (!store) throw new NotFoundError('loja', storeId);

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        name: input.name,
        kind: input.kind ?? store.kind,
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
        active: input.active ?? store.active,
      },
    });
  }

  /**
   * Cria o terminal e devolve o código de ativação **uma única vez**.
   * A série fiscal é sequencial no CNPJ: duas séries nunca compartilham numeração.
   */
  async createTerminal(tenantId: string, storeId: string, code: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, tenantId } });
    if (!store) throw new NotFoundError('loja', storeId);

    const active = await this.prisma.terminal.count({ where: { tenantId, status: 'active' } });
    await this.entitlements.assertWithinLimit(tenantId, 'terminals', active);

    const taken = await this.prisma.terminal.findFirst({ where: { tenantId, storeId, code } });
    if (taken) throw new ConflictError('TERMINAL_CODE_IN_USE', 'Já existe um terminal com este código na loja');

    const lastSeries = await this.prisma.terminal.aggregate({
      where: { tenantId },
      _max: { fiscalSeries: true },
    });

    const terminal = await this.prisma.terminal.create({
      data: {
        tenantId,
        storeId,
        code,
        fiscalSeries: (lastSeries._max.fiscalSeries ?? 0) + 1,
        deviceToken: buildActivationCode(store.code),
      },
    });

    return {
      id: terminal.id,
      code: terminal.code,
      fiscalSeries: terminal.fiscalSeries,
      activationCode: terminal.deviceToken,
    };
  }

  /** Troca o código de ativação — usado quando um terminal é trocado ou some. */
  async regenerateActivation(tenantId: string, terminalId: string) {
    const terminal = await this.prisma.terminal.findFirst({
      where: { id: terminalId, tenantId },
      include: { store: true },
    });
    if (!terminal) throw new NotFoundError('terminal', terminalId);

    const updated = await this.prisma.terminal.update({
      where: { id: terminalId },
      data: { deviceToken: buildActivationCode(terminal.store.code), lastSeenAt: null },
    });
    return { id: updated.id, activationCode: updated.deviceToken };
  }

  async setTerminalStatus(tenantId: string, terminalId: string, status: 'active' | 'disabled') {
    const terminal = await this.prisma.terminal.findFirst({ where: { id: terminalId, tenantId } });
    if (!terminal) throw new NotFoundError('terminal', terminalId);
    return this.prisma.terminal.update({ where: { id: terminalId }, data: { status } });
  }
}

function buildActivationCode(storeCode: string): string {
  return `soul-pdv-${storeCode.toLowerCase()}-${randomBytes(4).toString('hex')}`;
}
