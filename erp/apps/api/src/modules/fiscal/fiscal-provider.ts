/**
 * Camada anticorrupção do fiscal.
 *
 * A emissão é feita por API de terceiro (PlugNotas, Tecnospeed, Focus NFe...),
 * então nada acima desta interface sabe qual é o provedor. Trocar de fornecedor
 * é escrever um adaptador novo, não mexer no PDV.
 */
export interface FiscalIssueItem {
  lineNumber: number;
  code: string;
  description: string;
  ncm: string | null;
  cfop: string | null;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  discountCents: number;
}

export interface FiscalIssuePayment {
  method: string;
  amountCents: number;
  cardBrand?: string;
  installments?: number;
}

export interface FiscalIssueInput {
  documentId: string;
  model: 65 | 55;
  series: number;
  environment: 1 | 2;
  issuer: {
    cnpj: string;
    legalName: string;
    tradeName: string;
    ie: string | null;
    crt: number;
    address: Record<string, unknown>;
  };
  customerDocument?: string | null;
  items: FiscalIssueItem[];
  payments: FiscalIssuePayment[];
  totalCents: number;
  discountCents: number;
  occurredAt: Date;
}

export interface FiscalIssueResult {
  status: 'authorized' | 'rejected' | 'processing';
  providerRef: string;
  accessKey?: string;
  number?: number;
  protocol?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  qrCode?: string;
  rejection?: { code: string; message: string; retryable: boolean };
}

export interface FiscalEventResult {
  status: 'accepted' | 'rejected';
  protocol?: string;
  message?: string;
}

export interface FiscalProvider {
  readonly name: string;
  issue(input: FiscalIssueInput): Promise<FiscalIssueResult>;
  cancel(providerRef: string, reason: string): Promise<FiscalEventResult>;
  status(providerRef: string): Promise<FiscalIssueResult>;
}

export const FISCAL_PROVIDER = Symbol('FISCAL_PROVIDER');
