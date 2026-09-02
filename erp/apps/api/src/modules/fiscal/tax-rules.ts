/**
 * Regra tributária do item na NFC-e.
 *
 * Esta é a parte que rejeita nota na vida real. O gateway fiscal tira o
 * trabalho de certificado e transmissão, mas não adivinha tributação: CSOSN,
 * CFOP e CEST errados continuam voltando da SEFAZ como rejeição.
 *
 * O caso do quiosque de sorvete é o exemplo exato. Sorvete industrializado
 * (NCM 2105.00.10 e 2105.00.90) está no regime de **substituição tributária**:
 * a indústria já recolheu o ICMS de toda a cadeia. Quando o quiosque revende,
 * ele é *contribuinte substituído* — não recolhe ICMS de novo, e precisa dizer
 * isso na nota com três campos casados entre si:
 *
 *   - **CEST** obrigatório — sorvete de qualquer espécie é 23.001.00
 *     (a SEFAZ rejeita produto de ST sem CEST);
 *   - **CSOSN 500** (Simples) ou **CST 60** (regime normal);
 *   - **CFOP 5405** em vez de 5102.
 *
 * Mandar CSOSN 102 num pote de sorvete, como fazíamos, é declarar que o
 * quiosque é quem tributa o ICMS de um produto já tributado.
 */

/** CRT 1 e 2 são Simples Nacional; 3 é regime normal. */
export function isSimplesNacional(crt: number): boolean {
  return crt !== 3;
}

/**
 * Sobrescrita por produto, guardada em `TaxProfile.rules`. Existe porque
 * nenhuma regra automática cobre todo catálogo — o contador acerta a exceção
 * pela retaguarda, sem deploy.
 */
export interface TaxProfileRules {
  /** CSOSN (Simples) ou CST do ICMS (regime normal). */
  icmsSituacao?: string;
  cfop?: string;
  pisSituacao?: string;
  cofinsSituacao?: string;
  /** Força o tratamento de substituição tributária mesmo sem CEST no cadastro. */
  substituicaoTributaria?: boolean;
}

export interface ItemTaxContext {
  crt: number;
  /** CEST do produto. Preenchido = produto na lista de substituição tributária. */
  cest: string | null;
  /** CFOP do cadastro do produto, quando alguém já definiu um. */
  cfop: string | null;
  rules: TaxProfileRules | null;
}

export interface ResolvedItemTax {
  icmsSituacao: string;
  cfop: string;
  pisSituacao: string;
  cofinsSituacao: string;
  /** Verdadeiro quando o item foi tratado como já tributado por ST. */
  substituicaoTributaria: boolean;
}

/** Venda dentro do estado, mercadoria de terceiro sem ST. */
export const CFOP_VENDA_INTERNA = '5102';
/** Venda dentro do estado de mercadoria com ICMS já retido por ST. */
export const CFOP_VENDA_INTERNA_ST = '5405';

/** CSOSN 500 — ICMS cobrado anteriormente por substituição tributária. */
export const CSOSN_ST = '500';
/** CSOSN 102 — tributada pelo Simples, sem permissão de crédito. */
export const CSOSN_SEM_CREDITO = '102';
/** CST 60 — ICMS cobrado anteriormente por substituição tributária. */
export const CST_ST = '60';
/** CST 00 — tributada integralmente. */
export const CST_TRIBUTADA = '00';

/**
 * PIS/COFINS no Simples Nacional. A empresa recolhe dentro da guia única, então
 * a saída é lançada como "outras operações" — não como isenta, que descreve
 * outra situação e desalinha a EFD.
 */
export const PIS_COFINS_SIMPLES = '49';
/** Alíquota básica, para quem apura PIS/COFINS por fora. */
export const PIS_COFINS_NORMAL = '01';

/**
 * Um item só é tratado como ST quando o cadastro diz que ele é: CEST preenchido,
 * ou a regra do perfil marcando explicitamente. Nunca por adivinhação a partir
 * do NCM — a lista de ST muda por estado e por protocolo, e errar para mais é
 * tão ruim quanto errar para menos.
 */
export function hasSubstituicaoTributaria(context: ItemTaxContext): boolean {
  if (context.rules?.substituicaoTributaria !== undefined) {
    return context.rules.substituicaoTributaria;
  }
  return Boolean(context.cest && context.cest.trim().length > 0);
}

export function resolveItemTax(context: ItemTaxContext): ResolvedItemTax {
  const simples = isSimplesNacional(context.crt);
  const st = hasSubstituicaoTributaria(context);
  const rules = context.rules ?? {};

  const icmsPadrao = simples
    ? st
      ? CSOSN_ST
      : CSOSN_SEM_CREDITO
    : st
      ? CST_ST
      : CST_TRIBUTADA;

  // A precedência é sempre a mesma: regra do produto, depois cadastro do
  // produto, depois o padrão do regime. O que o contador escreveu ganha.
  return {
    icmsSituacao: rules.icmsSituacao ?? icmsPadrao,
    cfop: rules.cfop ?? context.cfop ?? (st ? CFOP_VENDA_INTERNA_ST : CFOP_VENDA_INTERNA),
    pisSituacao: rules.pisSituacao ?? (simples ? PIS_COFINS_SIMPLES : PIS_COFINS_NORMAL),
    cofinsSituacao: rules.cofinsSituacao ?? (simples ? PIS_COFINS_SIMPLES : PIS_COFINS_NORMAL),
    substituicaoTributaria: st,
  };
}

/**
 * Lê `TaxProfile.rules`, que é `Json` no banco e portanto `unknown` aqui.
 * Campo desconhecido é descartado em silêncio: perfil mal preenchido não pode
 * derrubar a emissão do quiosque inteiro.
 */
export function parseTaxProfileRules(raw: unknown): TaxProfileRules | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const rules: TaxProfileRules = {};

  for (const key of ['icmsSituacao', 'cfop', 'pisSituacao', 'cofinsSituacao'] as const) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) rules[key] = value.trim();
  }
  if (typeof source.substituicaoTributaria === 'boolean') {
    rules.substituicaoTributaria = source.substituicaoTributaria;
  }

  return Object.keys(rules).length > 0 ? rules : null;
}

/**
 * O CEST tem 7 dígitos e costuma ser cadastrado com pontos (23.001.00).
 * A SEFAZ quer só os dígitos.
 */
export function normalizeCest(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length === 7 ? digits : undefined;
}
