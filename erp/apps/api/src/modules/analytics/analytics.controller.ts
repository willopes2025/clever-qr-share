import { Controller, Get, Query } from '@nestjs/common';
import { Ctx, RequiresFeature } from '../../common/auth/decorators';
import type { RequestContext } from '../../common/tenancy/request-context';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@RequiresFeature('performance')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Números do dia por quiosque — a tela que o dono deixa aberta no celular. */
  @Get('live')
  live(@Ctx() ctx: RequestContext) {
    return this.analytics.live(ctx.tenantIds);
  }

  @Get('hourly')
  hourly(
    @Ctx() ctx: RequestContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    const range = parseRange(from, to);
    return this.analytics.hourlyCurve(ctx.tenantIds, range.from, range.to, storeId);
  }

  @Get('mix')
  mix(@Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.analytics.productMix(ctx.tenantIds, range.from, range.to);
  }
}

const DEFAULT_WINDOW_DAYS = 7;

function parseRange(from?: string, to?: string): { from: Date; to: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
  return { from: start, to: end };
}
