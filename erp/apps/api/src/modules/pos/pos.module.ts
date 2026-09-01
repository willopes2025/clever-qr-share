import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BootstrapService } from './bootstrap.service';
import { CashSessionService } from './cash-session.service';
import { PosController, SyncController } from './pos.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CatalogModule, InventoryModule, FiscalModule, TenancyModule],
  controllers: [PosController, SyncController],
  providers: [BootstrapService, CashSessionService, SyncService],
  exports: [BootstrapService],
})
export class PosModule {}
