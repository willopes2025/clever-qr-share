import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { StoreAdminController } from './store-admin.controller';
import { StoreAdminService } from './store-admin.service';
import { UsageService } from './usage.service';

@Module({
  controllers: [StoreAdminController],
  providers: [EntitlementsService, UsageService, StoreAdminService],
  exports: [EntitlementsService, UsageService],
})
export class TenancyModule {}
