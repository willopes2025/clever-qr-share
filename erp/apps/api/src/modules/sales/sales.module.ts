import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [TenancyModule, InventoryModule, FiscalModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
