import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuard } from './common/auth/auth.guard';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { EventsModule } from './common/events/events.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RequestContextMiddleware } from './common/tenancy/request-context.middleware';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { IamModule } from './modules/iam/iam.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PosModule } from './modules/pos/pos.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    TenancyModule,
    IamModule,
    CatalogModule,
    InventoryModule,
    FiscalModule,
    PosModule,
    AnalyticsModule,
    TelemetryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
