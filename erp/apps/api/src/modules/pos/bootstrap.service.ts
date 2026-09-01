import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService, type CatalogItem } from '../catalog/catalog.service';
import { EntitlementsService } from '../tenancy/entitlements.service';

export interface PosBootstrap {
  tenant: { id: string; tradeName: string; cnpj: string };
  store: { id: string; name: string; code: string };
  terminal: { id: string; code: string; fiscalSeries: number };
  operators: Array<{ id: string; name: string }>;
  catalog: CatalogItem[];
  features: string[];
  openSession: { id: string; openedAt: Date; openingFloatCents: number } | null;
  syncedAt: string;
}

/**
 * Pacote que o PDV baixa ao abrir e guarda localmente.
 * É o que permite vender com a internet caída — sem ele, não há modo offline.
 */
@Injectable()
export class BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async load(tenantId: string, terminalId: string): Promise<PosBootstrap> {
    const terminal = await this.prisma.terminal.findFirstOrThrow({
      where: { id: terminalId, tenantId },
      include: { store: { include: { tenant: true } } },
    });

    const [operators, catalog, entitlements, openSession] = await Promise.all([
      this.prisma.appUser.findMany({
        where: { tenantId, status: 'active', pinHash: { not: null } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.catalog.listForStore(tenantId, terminal.storeId),
      this.entitlements.resolve(tenantId),
      this.prisma.cashSession.findFirst({
        where: { tenantId, terminalId, status: 'open' },
        select: { id: true, openedAt: true, openingFloatCents: true },
      }),
    ]);

    return {
      tenant: {
        id: terminal.store.tenant.id,
        tradeName: terminal.store.tenant.tradeName,
        cnpj: terminal.store.tenant.cnpj,
      },
      store: { id: terminal.store.id, name: terminal.store.name, code: terminal.store.code },
      terminal: { id: terminal.id, code: terminal.code, fiscalSeries: terminal.fiscalSeries },
      operators,
      catalog,
      features: entitlements.features,
      openSession: openSession
        ? {
            id: openSession.id,
            openedAt: openSession.openedAt,
            openingFloatCents: Number(openSession.openingFloatCents),
          }
        : null,
      syncedAt: new Date().toISOString(),
    };
  }
}
