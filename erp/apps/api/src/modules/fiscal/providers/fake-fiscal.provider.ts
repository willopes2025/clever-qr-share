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
 * propósito nos dois erros de cadastro que mais aparecem: item sem NCM e item
 * tratado como substituição tributária sem CEST. Ensaiar com um dublê mais
 * permissivo que a SEFAZ só adia a descoberta para o dia da inauguração.
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

    const itemStSemCest = input.items.find((item) => item.tax.substituicaoTributaria && !item.cest);
    if (itemStSemCest) {
      return {
        status: 'rejected',
        providerRef: randomUUID(),
        rejection: {
          code: '806',
          message: `CEST ausente no item ${itemStSemCest.lineNumber} (${itemStSemCest.description}), que está em substituição tributária`,
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

/**
 * Monta uma chave com a mesma estrutura da real: UF, AAMM, CNPJ, modelo, série,
 * número, tipo de emissão, código numérico e dígito.
 *
 * O código numérico é sorteado, como é na NF-e de verdade. Derivá-lo do número
 * da nota fazia a chave se repetir a cada reinício do processo — a sequência
 * volta a 1 e colide com o que já está gravado, e a nota nunca autoriza.
 */
function buildFakeAccessKey(cnpj: string, series: number, number: number): string {
  const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '');
  const numericCode = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const base =
    `35${yearMonth}${cnpj}65${String(series).padStart(3, '0')}` +
    `${String(number).padStart(9, '0')}1${numericCode}`;
  return base.slice(0, 44).padEnd(44, '0');
}
