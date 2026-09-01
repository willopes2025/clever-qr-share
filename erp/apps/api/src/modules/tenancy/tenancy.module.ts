import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { UsageService } from './usage.service';

@Module({
  providers: [EntitlementsService, UsageService],
  exports: [EntitlementsService, UsageService],
})
export class TenancyModule {}
