import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { FISCAL_PROVIDER } from './fiscal-provider';
import { FakeFiscalProvider } from './providers/fake-fiscal.provider';
import { RestFiscalProvider } from './providers/plugnotas.provider';

/**
 * O provedor é escolhido por configuração. Em desenvolvimento e em teste roda o
 * fake, que não depende de rede nem de contrato assinado.
 */
@Module({
  imports: [TenancyModule],
  controllers: [FiscalController],
  providers: [
    FiscalService,
    FakeFiscalProvider,
    RestFiscalProvider,
    {
      provide: FISCAL_PROVIDER,
      inject: [FakeFiscalProvider, RestFiscalProvider],
      useFactory: (fake: FakeFiscalProvider, rest: RestFiscalProvider) =>
        (process.env.FISCAL_PROVIDER ?? 'fake') === 'fake' ? fake : rest,
    },
  ],
  exports: [FiscalService],
})
export class FiscalModule {}
