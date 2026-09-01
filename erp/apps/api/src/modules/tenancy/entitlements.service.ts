import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import { UNLIMITED, type PlanLimits } from './plan-features';

interface ResolvedEntitlements {
  planCode: string;
  features: string[];
  limits: PlanLimits;
}

/**
 * Resolve o que o tenant pode usar: plano contratado mais ajustes comerciais.
 * Cacheado em memória por um minuto — troca de plano reflete quase na hora
 * sem custo de consulta em toda requisição.
 */
@Injectable()
export class EntitlementsService {
  private static readonly CACHE_TTL_MS = 60_000;
  private readonly cache = new Map<string, { value: ResolvedEntitlements; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async resolve(tenantId: string): Promise<ResolvedEntitlements> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true, entitlements: true },
    });
    if (!tenant) throw new NotFoundError('tenant', tenantId);

    const planFeatures = (tenant.plan.features as string[]) ?? [];
    const planLimits = tenant.plan.limits as unknown as PlanLimits;

    const features = new Set(planFeatures);
    const limits: PlanLimits = { ...planLimits };

    for (const override of tenant.entitlements) {
      if (override.expiresAt && override.expiresAt < new Date()) continue;
      if (typeof override.value === 'boolean') {
        if (override.value) features.add(override.key);
        else features.delete(override.key);
      } else if (typeof override.value === 'number') {
        (limits as unknown as Record<string, number>)[override.key] = override.value;
      }
    }

    const value: ResolvedEntitlements = { planCode: tenant.plan.code, features: [...features], limits };
    this.cache.set(tenantId, { value, expiresAt: Date.now() + EntitlementsService.CACHE_TTL_MS });
    return value;
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /** Barra a criação de mais um terminal/usuário do que o plano permite. */
  async assertWithinLimit(tenantId: string, limit: keyof PlanLimits, currentCount: number): Promise<void> {
    const { limits, planCode } = await this.resolve(tenantId);
    const allowed = limits[limit];
    if (allowed === UNLIMITED) return;
    if (currentCount >= allowed) {
      throw new ForbiddenError('PLAN_LIMIT_REACHED', `Limite do plano atingido para ${limit}`, {
        limit,
        allowed,
        current: currentCount,
        plan: planCode,
      });
    }
  }
}
