import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Medição de consumo por tenant — o que a revenda fatura no fim do mês. */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async increment(tenantId: string, metric: 'invoices' | 'sales' | 'terminals' | 'users', by = 1): Promise<void> {
    const period = startOfMonth(new Date());
    await this.prisma.usageCounter.upsert({
      where: { tenantId_period_metric: { tenantId, period, metric } },
      create: { tenantId, period, metric, value: BigInt(by) },
      update: { value: { increment: BigInt(by) } },
    });
  }

  async currentMonth(tenantId: string): Promise<Record<string, number>> {
    const counters = await this.prisma.usageCounter.findMany({
      where: { tenantId, period: startOfMonth(new Date()) },
    });
    return Object.fromEntries(counters.map((counter) => [counter.metric, Number(counter.value)]));
  }
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
