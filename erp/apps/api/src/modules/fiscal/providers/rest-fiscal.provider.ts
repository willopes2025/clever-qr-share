import { Injectable, Logger } from '@nestjs/common';
import type {
  FiscalEventResult,
  FiscalIssueInput,
  FiscalIssueResult,
  FiscalProvider,
} from '../fiscal-provider';

/**
 * Adaptador REST genérico — a reserva, não o provedor em uso.
 *
 * O provedor contratado é a Focus NFe (`FocusNfeProvider`). Este adaptador existe
 * para o dia em que o fornecedor mudar: a URL e o formato mudam por fornecedor,
 * o contrato daqui para dentro não. Trocar é ajustar `toProviderPayload` e
 * `fromProviderResponse` — nada acima desta camada precisa saber.
 */
@Injectable()
export class RestFiscalProvider implements FiscalProvider {
  readonly name = process.env.FISCAL_PROVIDER ?? 'rest';
  private readonly logger = new Logger(RestFiscalProvider.name);
  private readonly baseUrl = process.env.FISCAL_BASE_URL ?? '';
  private readonly apiKey = process.env.FISCAL_API_KEY ?? '';

  async issue(input: FiscalIssueInput): Promise<FiscalIssueResult> {
    const response = await this.request('POST', '/nfce', toProviderPayload(input));
    return fromProviderResponse(response);
  }

  async cancel(providerRef: string, reason: string): Promise<FiscalEventResult> {
    const response = await this.request('POST', `/nfce/${providerRef}/cancelamento`, { justificativa: reason });
    return { status: response.status === 'ok' ? 'accepted' : 'rejected', protocol: response.protocolo };
  }

  async status(providerRef: string): Promise<FiscalIssueResult> {
    return fromProviderResponse(await this.request('GET', `/nfce/${providerRef}`));
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Gateway fiscal respondeu ${response.status}: ${text}`);
      throw new Error(`FISCAL_GATEWAY_${response.status}`);
    }
    return response.json();
  }
}

function toProviderPayload(input: FiscalIssueInput): Record<string, unknown> {
  return {
    idIntegracao: input.documentId,
    ambiente: input.environment === 1 ? 'producao' : 'homologacao',
    serie: input.series,
    emitente: { cpfCnpj: input.issuer.cnpj, inscricaoEstadual: input.issuer.ie },
    destinatario: input.customerDocument ? { cpfCnpj: input.customerDocument } : undefined,
    itens: input.items.map((item) => ({
      numero: item.lineNumber,
      codigo: item.code,
      descricao: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unit,
      quantidade: item.quantity,
      valorUnitario: item.unitPriceCents / 100,
      valorTotal: item.totalCents / 100,
      desconto: item.discountCents / 100,
    })),
    pagamentos: input.payments.map((payment) => ({
      forma: payment.method,
      valor: payment.amountCents / 100,
      bandeira: payment.cardBrand,
      parcelas: payment.installments,
    })),
    valorTotal: input.totalCents / 100,
    desconto: input.discountCents / 100,
  };
}

function fromProviderResponse(response: any): FiscalIssueResult {
  if (response.situacao === 'rejeitado' || response.status === 'rejected') {
    return {
      status: 'rejected',
      providerRef: response.id,
      rejection: {
        code: String(response.codigoErro ?? 'UNKNOWN'),
        message: response.mensagem ?? 'Rejeitado pelo gateway',
        // Erro da SEFAZ na faixa 5xx costuma ser indisponibilidade: vale reenviar.
        retryable: String(response.codigoErro ?? '').startsWith('5'),
      },
    };
  }

  if (response.situacao === 'processando') {
    return { status: 'processing', providerRef: response.id };
  }

  return {
    status: 'authorized',
    providerRef: response.id,
    accessKey: response.chave,
    number: response.numero,
    protocol: response.protocolo,
    xmlUrl: response.xmlUrl,
    danfeUrl: response.danfeUrl,
    qrCode: response.qrCode,
  };
}
