import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  slot: string;
  salesCount: number;
  revenueCents: number;
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
    const today = dayRange(reference);
    const lastWeek = dayRange(new Date(reference.getTime() - 7 * 86_400_000));

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

  /** Curva de horário em faixas de 30 minutos — base da escala de gente. */
  async hourlyCurve(tenantIds: string[], from: Date, to: Date, storeId?: string): Promise<HourSlot[]> {
    const storeFilter = storeId ? Prisma.sql`AND store_id = ${storeId}::uuid` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ slot: Date; sales_count: bigint; revenue_cents: bigint }>>(
      Prisma.sql`
        SELECT
          date_trunc('hour', occurred_at)
            + floor(extract(minute FROM occurred_at) / 30) * interval '30 minutes' AS slot,
          count(*)         AS sales_count,
          sum(total_cents) AS revenue_cents
        FROM sale
        WHERE tenant_id = ANY(${tenantIds}::text[])
          AND status = 'completed'
          AND occurred_at >= ${from}
          AND occurred_at < ${to}
          ${storeFilter}
        GROUP BY 1
        ORDER BY 1
      `,
    );

    return rows.map((row) => ({
      slot: row.slot.toISOString(),
      salesCount: Number(row.sales_count),
      revenueCents: Number(row.revenue_cents),
    }));
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

function dayRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
