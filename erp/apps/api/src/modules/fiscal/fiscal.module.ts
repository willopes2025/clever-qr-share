import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FiscalController } from './fiscal.controller';
import { FiscalWebhookController } from './fiscal-webhook.controller';
import { FiscalService } from './fiscal.service';
import { FISCAL_PROVIDER } from './fiscal-provider';
import { FakeFiscalProvider } from './providers/fake-fiscal.provider';
import { FocusNfeProvider } from './providers/focus-nfe.provider';
import { RestFiscalProvider } from './providers/rest-fiscal.provider';

/**
 * O provedor é escolhido por configuração. Em desenvolvimento e em teste roda o
 * fake, que não depende de rede nem de contrato assinado.
 */
@Module({
  imports: [TenancyModule],
  controllers: [FiscalController, FiscalWebhookController],
  providers: [
    FiscalService,
    FakeFiscalProvider,
    FocusNfeProvider,
    RestFiscalProvider,
    {
      provide: FISCAL_PROVIDER,
      inject: [FakeFiscalProvider, FocusNfeProvider, RestFiscalProvider],
      useFactory: (fake: FakeFiscalProvider, focus: FocusNfeProvider, rest: RestFiscalProvider) => {
        switch (process.env.FISCAL_PROVIDER ?? 'fake') {
          case 'focus':
            return focus;
          case 'fake':
            return fake;
          default:
            return rest;
        }
      },
    },
  ],
  exports: [FiscalService],
})
export class FiscalModule {}
