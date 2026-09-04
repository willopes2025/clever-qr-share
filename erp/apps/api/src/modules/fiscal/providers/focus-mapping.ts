import type { FiscalIssueInput, FiscalIssueResult } from '../fiscal-provider';
import { isSimplesNacional, normalizeCest } from '../tax-rules';

/**
 * Tradução entre o nosso modelo e o da Focus NFe.
 *
 * Fica separada da chamada HTTP de propósito: é a parte que erra na prática —
 * um CFOP trocado, um CSOSN errado, um valor com centavo a mais — e assim pode
 * ser testada sem rede, campo a campo.
 *
 * A referência da Focus (`ref`) é o id do nosso documento fiscal. Isso torna o
 * reenvio inofensivo: mandar duas vezes a mesma referência não gera duas notas.
 */

/** Forma de pagamento conforme a tabela da NFC-e. */
const PAYMENT_CODES: Record<string, string> = {
  cash: '01',        // dinheiro
  credit: '03',      // cartão de crédito
  debit: '04',       // cartão de débito
  voucher: '10',     // vale alimentação
  pix: '17',         // pagamento instantâneo
  store_credit: '05',// crédito da loja
};

const CARD_BRANDS: Record<string, string> = {
  visa: '01',
  master: '02',
  mastercard: '02',
  amex: '04',
  elo: '06',
  hipercard: '07',
};

export interface FocusTaxDefaults {
  /** CSOSN no Simples Nacional; CST quando o regime é normal. */
  icmsSituacao: string;
  pisSituacao: string;
  cofinsSituacao: string;
  cfop: string;
  naturezaOperacao: string;
}

/**
 * Padrões por regime. Continuam existindo para a natureza da operação e como
 * rede de segurança, mas a tributação de cada item vem resolvida em
 * `item.tax` — ver `tax-rules.ts`. Um pote de sorvete e uma garrafa de água
 * saem na mesma nota com CSOSN diferentes, e um padrão único não daria conta.
 */
export const SIMPLES_DEFAULTS: FocusTaxDefaults = {
  icmsSituacao: '102', // CSOSN 102 — sem permissão de crédito
  pisSituacao: '49',
  cofinsSituacao: '49',
  cfop: '5102',
  naturezaOperacao: 'Venda de mercadoria',
};

export const REGIME_NORMAL_DEFAULTS: FocusTaxDefaults = {
  icmsSituacao: '00',
  pisSituacao: '01',
  cofinsSituacao: '01',
  cfop: '5102',
  naturezaOperacao: 'Venda de mercadoria',
};

export function taxDefaultsFor(crt: number): FocusTaxDefaults {
  // CRT 1 e 2 são Simples Nacional; 3 é regime normal.
  return crt === 3 ? REGIME_NORMAL_DEFAULTS : SIMPLES_DEFAULTS;
}

/**
 * Texto exigido pela LC 123 para quem é optante pelo Simples Nacional e não
 * destaca ICMS na nota. Vai no campo de informações complementares.
 */
export const OBSERVACAO_SIMPLES =
  'Documento emitido por ME ou EPP optante pelo Simples Nacional. ' +
  'Nao gera direito a credito fiscal de ICMS, IPI, PIS e COFINS.';

/** Centavos → número decimal com duas casas, como a Focus espera. */
export function toAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

/**
 * A Focus NFe lê `data_emissao` como horário local do emitente — ela não
 * interpreta o "Z" do ISO 8601. Mandar `occurredAt.toISOString()` manda o
 * horário em UTC etiquetado como se já fosse local, adiantando o relógio em
 * 3 horas: a SEFAZ recebe uma nota "emitida no futuro" e rejeita com o
 * código 703 (Data-Hora de Emissão posterior ao horário de recebimento).
 * O Brasil aboliu o horário de verão em 2019, então America/Sao_Paulo é
 * sempre UTC-03:00 — e é onde fica todo cliente do MVP.
 */
function toEmissionTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}-03:00`;
}

export function buildNfcePayload(input: FiscalIssueInput): Record<string, unknown> {
  const defaults = taxDefaultsFor(input.issuer.crt);
  const simples = isSimplesNacional(input.issuer.crt);

  // O que o cliente entregou menos o que voltou de troco. Em dinheiro os dois
  // são diferentes, e é a diferença — não o valor entregue — que precisa fechar
  // com o total da nota, senão a SEFAZ rejeita por divergência de pagamento.
  const trocoCents = input.payments.reduce((total, payment) => total + (payment.changeCents ?? 0), 0);

  return {
    natureza_operacao: defaults.naturezaOperacao,
    data_emissao: toEmissionTimestamp(input.occurredAt),
    // 1 = operação presencial: o cliente está no balcão.
    presenca_comprador: '1',
    modalidade_frete: '9',
    local_destino: '1',
    cnpj_emitente: input.issuer.cnpj,
    serie: input.series,
    ...(input.customerDocument
      ? {
          cpf_destinatario: input.customerDocument,
          // 9 = não contribuinte do ICMS. É o consumidor final do quiosque.
          indicador_inscricao_estadual_destinatario: '9',
        }
      : {}),
    ...(simples ? { informacoes_adicionais_contribuinte: OBSERVACAO_SIMPLES } : {}),
    valor_produtos: toAmount(input.totalCents + input.discountCents),
    valor_desconto: toAmount(input.discountCents),
    valor_total: toAmount(input.totalCents),
    ...(trocoCents > 0 ? { valor_troco: toAmount(trocoCents) } : {}),
    items: input.items.map((item) => {
      const cest = normalizeCest(item.cest);
      return {
        numero_item: item.lineNumber,
        codigo_produto: item.code,
        descricao: item.description,
        codigo_ncm: item.ncm ?? undefined,
        // A SEFAZ rejeita produto sujeito a substituição tributária sem CEST.
        ...(cest ? { cest } : {}),
        cfop: item.tax.cfop,
        // "SEM GTIN" é o valor que a SEFAZ espera quando o produto não tem
        // código de barras de verdade; deixar em branco reprova a validação.
        codigo_barras_comercial: item.gtin ?? 'SEM GTIN',
        codigo_barras_tributavel: item.gtin ?? 'SEM GTIN',
        unidade_comercial: item.unit,
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: toAmount(item.unitPriceCents),
        valor_bruto: toAmount(item.totalCents + item.discountCents),
        valor_desconto: toAmount(item.discountCents),
        unidade_tributavel: item.unit,
        quantidade_tributavel: item.quantity,
        valor_unitario_tributavel: toAmount(item.unitPriceCents),
        icms_origem: String(item.origin ?? 0),
        icms_situacao_tributaria: item.tax.icmsSituacao,
        pis_situacao_tributaria: item.tax.pisSituacao,
        cofins_situacao_tributaria: item.tax.cofinsSituacao,
        inclui_no_total: '1',
      };
    }),
    formas_pagamento: input.payments.map((payment) => ({
      forma_pagamento: PAYMENT_CODES[payment.method] ?? '99',
      // O que efetivamente ficou no caixa: entregue menos troco.
      valor_pagamento: toAmount(payment.amountCents - (payment.changeCents ?? 0)),
      // 2 = pagamento não integrado ao sistema. O quiosque não tem TEF: o
      // operador passa na maquineta e lança aqui o que aconteceu.
      ...(payment.cardBrand
        ? {
            bandeira_operadora: CARD_BRANDS[payment.cardBrand.toLowerCase()] ?? '99',
            tipo_integracao: '2',
          }
        : {}),
    })),
  };
}

interface FocusResponse {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string | number;
  serie?: string | number;
  protocolo?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  qrcode_url?: string;
  url_consulta_nf?: string;
  erros?: Array<{ campo?: string; mensagem?: string }>;
  codigo?: string;
  mensagem?: string;
}

/**
 * Rejeições que somem sozinhas: indisponibilidade da SEFAZ, timeout, fila cheia.
 * Erro de cadastro — NCM, CFOP, CSOSN — não some tentando de novo e precisa de
 * alguém corrigir, então vai para a tela de correção em vez de girar na fila.
 */
const RETRYABLE_SEFAZ_CODES = new Set(['108', '109', '110', '999', '539']);

export function parseFocusResponse(raw: unknown, baseUrl: string, ref: string): FiscalIssueResult {
  const response = (raw ?? {}) as FocusResponse;
  const status = response.status ?? '';

  if (status === 'autorizado') {
    return {
      status: 'authorized',
      providerRef: ref,
      accessKey: normalizeAccessKey(response.chave_nfe),
      number: response.numero ? Number(response.numero) : undefined,
      protocol: response.protocolo,
      xmlUrl: absolute(baseUrl, response.caminho_xml_nota_fiscal),
      danfeUrl: absolute(baseUrl, response.caminho_danfe),
      qrCode: response.qrcode_url ?? response.url_consulta_nf,
    };
  }

  if (status === 'processando_autorizacao') {
    return { status: 'processing', providerRef: ref };
  }

  // Erro de validação da Focus vem sem `status`, só com `codigo` e `erros`. Sem
  // esta checagem ele seria lido como "processando" e giraria na fila para sempre.
  const hasError = Boolean(response.codigo || response.erros?.length || response.status_sefaz);
  if (!status && !hasError) {
    return { status: 'processing', providerRef: ref };
  }

  // erro_autorizacao, denegado, ou erro de validação da própria Focus
  const code = response.status_sefaz ?? response.codigo ?? 'UNKNOWN';
  return {
    status: 'rejected',
    providerRef: ref,
    rejection: {
      code: String(code),
      message: describeRejection(response),
      retryable: RETRYABLE_SEFAZ_CODES.has(String(code)),
    },
  };
}

/** Junta a mensagem da SEFAZ com os erros de validação, que vêm separados. */
export function describeRejection(response: FocusResponse): string {
  const sefaz = response.mensagem_sefaz ?? response.mensagem;
  const validation = (response.erros ?? [])
    .map((error) => [error.campo, error.mensagem].filter(Boolean).join(': '))
    .filter(Boolean);

  return [sefaz, ...validation].filter(Boolean).join(' · ') || 'Rejeitado sem detalhe';
}

/**
 * A Focus devolve a chave prefixada com "NFe" (47 caracteres). A chave de acesso
 * de verdade são os 44 dígitos — é o que vai no cupom, no QR Code e na consulta
 * do consumidor, e é o tamanho da coluna. Sem tirar o prefixo a gravação falha.
 */
export function normalizeAccessKey(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length === 44 ? digits : undefined;
}

function absolute(baseUrl: string, path?: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${baseUrl}${path}`;
}
