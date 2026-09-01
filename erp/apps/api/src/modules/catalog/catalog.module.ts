import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductAdminController } from './product-admin.controller';
import { ProductAdminService } from './product-admin.service';

@Module({
  controllers: [CatalogController, ProductAdminController],
  providers: [CatalogService, ProductAdminService],
  exports: [CatalogService],
})
export class CatalogModule {}
