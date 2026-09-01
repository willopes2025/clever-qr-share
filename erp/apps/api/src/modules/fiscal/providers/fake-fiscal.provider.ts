import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  FiscalEventResult,
  FiscalIssueInput,
  FiscalIssueResult,
  FiscalProvider,
} from '../fiscal-provider';

/**
 * Provedor de mentira para desenvolvimento e teste.
 *
 * Permite rodar o ERP inteiro — inclusive a fila e o tratamento de rejeição —
 * sem depender de rede nem de contrato assinado com fornecedor. Rejeita de
 * propósito quando o item está sem NCM, que é o erro de cadastro mais comum.
 */
@Injectable()
export class FakeFiscalProvider implements FiscalProvider {
  readonly name = 'fake';
  private readonly logger = new Logger(FakeFiscalProvider.name);
  private sequence = 1;

  async issue(input: FiscalIssueInput): Promise<FiscalIssueResult> {
    const itemWithoutNcm = input.items.find((item) => !item.ncm);
    if (itemWithoutNcm) {
      return {
        status: 'rejected',
        providerRef: randomUUID(),
        rejection: {
          code: '778',
          message: `NCM ausente no item ${itemWithoutNcm.lineNumber} (${itemWithoutNcm.description})`,
          retryable: false,
        },
      };
    }

    const number = this.sequence++;
    const accessKey = buildFakeAccessKey(input.issuer.cnpj, input.series, number);
    this.logger.debug(`NFC-e simulada autorizada: ${accessKey}`);

    return {
      status: 'authorized',
      providerRef: randomUUID(),
      accessKey,
      number,
      protocol: `135${Date.now()}`,
      xmlUrl: `fake://xml/${accessKey}.xml`,
      danfeUrl: `fake://danfe/${accessKey}.pdf`,
      qrCode: `https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${accessKey}`,
    };
  }

  async cancel(providerRef: string, reason: string): Promise<FiscalEventResult> {
    if (reason.trim().length < 15) {
      return { status: 'rejected', message: 'Justificativa de cancelamento exige 15 caracteres' };
    }
    return { status: 'accepted', protocol: `999${Date.now()}` };
  }

  async status(providerRef: string): Promise<FiscalIssueResult> {
    return { status: 'processing', providerRef };
  }
}

function buildFakeAccessKey(cnpj: string, series: number, number: number): string {
  const base = `35${new Date().toISOString().slice(2, 7).replace('-', '')}${cnpj}65${String(series).padStart(3, '0')}${String(number).padStart(9, '0')}1${String(number).padStart(8, '0')}`;
  return base.slice(0, 44).padEnd(44, '0');
}
