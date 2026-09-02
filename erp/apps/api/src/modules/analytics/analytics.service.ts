import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { businessDayRange, businessTimezone } from '../../common/time/business-time';

export interface StorePerformance {
  storeId: string;
  storeName: string;
  revenueCents: number;
  salesCount: number;
  avgTicketCents: number;
}

export interface LivePerformance {
  date: string;
  revenueCents: number;
  salesCount: number;
  avgTicketCents: number;
  byStore: StorePerformance[];
  comparedToLastWeek: { revenueCents: number; variationPercent: number | null };
}

export interface HourSlot {
  /** Faixa do dia no formato "HH:MM" — a curva é do dia típico, não da linha do tempo. */
  slot: string;
  salesCount: number;
  revenueCents: number;
  /** Dias com movimento naquela faixa, para calcular a média diária. */
  days: number;
  avgRevenueCents: number;
}

export interface MixEntry {
  skuId: string;
  description: string;
  quantity: number;
  revenueCents: number;
  sharePercent: number;
}

/**
 * Performance do PDV — o segundo motivo de existir do sistema, junto com a nota.
 * Consultas de leitura, sem efeito colateral, prontas para ir à réplica.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async live(tenantIds: string[], reference = new Date()): Promise<LivePerformance> {
    const today = businessDayRange(reference);
    const lastWeek = businessDayRange(new Date(reference.getTime() - 7 * 86_400_000));

    const [stores, todaySales, lastWeekTotal] = await Promise.all([
      this.prisma.store.findMany({ where: { tenantId: { in: tenantIds }, active: true } }),
      this.prisma.sale.groupBy({
        by: ['storeId'],
        where: {
          tenantId: { in: tenantIds },
          status: 'completed',
          occurredAt: { gte: today.start, lt: today.end },
        },
        _sum: { totalCents: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: {
          tenantId: { in: tenantIds },
          status: 'completed',
          occurredAt: { gte: lastWeek.start, lt: lastWeek.end },
        },
        _sum: { totalCents: true },
      }),
    ]);

    const byStore: StorePerformance[] = stores
      .map((store) => {
        const row = todaySales.find((sale) => sale.storeId === store.id);
        const revenueCents = Number(row?._sum.totalCents ?? 0n);
        const salesCount = row?._count ?? 0;
        return {
          storeId: store.id,
          storeName: store.name,
          revenueCents,
          salesCount,
          avgTicketCents: salesCount > 0 ? Math.round(revenueCents / salesCount) : 0,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents);

    const revenueCents = byStore.reduce((total, store) => total + store.revenueCents, 0);
    const salesCount = byStore.reduce((total, store) => total + store.salesCount, 0);
    const previous = Number(lastWeekTotal._sum.totalCents ?? 0n);

    return {
      date: today.start.toISOString().slice(0, 10),
      revenueCents,
      salesCount,
      avgTicketCents: salesCount > 0 ? Math.round(revenueCents / salesCount) : 0,
      byStore,
      comparedToLastWeek: {
        revenueCents: previous,
        variationPercent: previous > 0 ? round1(((revenueCents - previous) / previous) * 100) : null,
      },
    };
  }

  /**
   * Curva do dia típico: agrega todas as datas do período na mesma faixa de 30
   * minutos. É o que responde "que horas o quiosque enche?" — plotar a linha do
   * tempo corrida responderia outra pergunta.
   */
  async hourlyCurve(tenantIds: string[], from: Date, to: Date, storeId?: string): Promise<HourSlot[]> {
    const timeZone = businessTimezone();
    const storeFilter = storeId ? Prisma.sql`AND store_id = ${storeId}::uuid` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ slot: string; sales_count: bigint; revenue_cents: bigint; days: bigint }>
    >(
      Prisma.sql`
        WITH venda AS (
          SELECT
            -- occurred_at é timestamp sem fuso, gravado em UTC. Ler a hora crua
            -- desenhava a venda das 15h às 18h na curva; aqui ela volta para o
            -- relógio do quiosque antes de virar faixa.
            (occurred_at AT TIME ZONE 'UTC' AT TIME ZONE ${timeZone}) AS hora_local,
            total_cents,
            store_id,
            tenant_id,
            status,
            occurred_at
          FROM sale
        )
        SELECT
          to_char(
            date_trunc('hour', hora_local)
              + floor(extract(minute FROM hora_local) / 30) * interval '30 minutes',
            'HH24:MI'
          )                                  AS slot,
          count(*)                           AS sales_count,
          sum(total_cents)                   AS revenue_cents,
          count(DISTINCT hora_local::date)   AS days
        FROM venda
        WHERE tenant_id = ANY(${tenantIds}::text[])
          AND status = 'completed'
          AND occurred_at >= ${from}
          AND occurred_at < ${to}
          ${storeFilter}
        GROUP BY 1
        ORDER BY 1
      `,
    );

    return rows.map((row) => {
      const revenueCents = Number(row.revenue_cents);
      const days = Math.max(Number(row.days), 1);
      return {
        slot: row.slot,
        salesCount: Number(row.sales_count),
        revenueCents,
        days,
        avgRevenueCents: Math.round(revenueCents / days),
      };
    });
  }

  /** Mix de produtos: quais sabores realmente sustentam o faturamento. */
  async productMix(tenantIds: string[], from: Date, to: Date, limit = 20): Promise<MixEntry[]> {
    const rows = await this.prisma.saleItem.groupBy({
      by: ['skuId', 'description'],
      where: {
        tenantId: { in: tenantIds },
        sale: { status: 'completed', occurredAt: { gte: from, lt: to } },
      },
      _sum: { totalCents: true, quantity: true },
      orderBy: { _sum: { totalCents: 'desc' } },
      take: limit,
    });

    const total = rows.reduce((sum, row) => sum + Number(row._sum.totalCents ?? 0n), 0);

    return rows.map((row) => {
      const revenueCents = Number(row._sum.totalCents ?? 0n);
      return {
        skuId: row.skuId,
        description: row.description,
        quantity: Number(row._sum.quantity ?? 0),
        revenueCents,
        sharePercent: total > 0 ? round1((revenueCents / total) * 100) : 0,
      };
    });
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
