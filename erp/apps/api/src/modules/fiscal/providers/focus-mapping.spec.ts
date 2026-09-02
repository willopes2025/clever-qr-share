import { describe, expect, it } from 'vitest';
import {
  buildNfcePayload,
  normalizeAccessKey,
  parseFocusResponse,
  SIMPLES_DEFAULTS,
  taxDefaultsFor,
  toAmount,
} from './focus-mapping';
import type { FiscalIssueInput } from '../fiscal-provider';

const venda: FiscalIssueInput = {
  documentId: '0193f0aa-1111-7000-8000-000000000001',
  model: 65,
  series: 1,
  environment: 2,
  issuer: {
    cnpj: '12345678000190',
    legalName: 'Soul Muscle Alimentos LTDA',
    tradeName: 'Soul Muscle',
    ie: '110042490114',
    crt: 1,
    address: {},
  },
  customerDocument: '11144477735',
  items: [
    {
      lineNumber: 1,
      code: '10301',
      description: 'Pote 1L Chocolate Belga',
      ncm: '21050010',
      cfop: '5102',
      unit: 'UN',
      quantity: 2,
      unitPriceCents: 3490,
      totalCents: 6980,
      discountCents: 0,
    },
  ],
  payments: [{ method: 'debit', amountCents: 7880, cardBrand: 'visa' }],
  totalCents: 7880,
  discountCents: 0,
  occurredAt: new Date('2026-09-14T19:32:00-03:00'),
};

describe('valores', () => {
  it('converte centavos em decimal com duas casas', () => {
    expect(toAmount(7880)).toBe(78.8);
    expect(toAmount(1)).toBe(0.01);
    expect(toAmount(123456789)).toBe(1234567.89);
  });
});

describe('regime tributário', () => {
  it('usa CSOSN do Simples para CRT 1', () => {
    expect(taxDefaultsFor(1)).toBe(SIMPLES_DEFAULTS);
    expect(taxDefaultsFor(1).icmsSituacao).toBe('102');
  });

  it('usa CST do regime normal para CRT 3', () => {
    expect(taxDefaultsFor(3).icmsSituacao).toBe('00');
  });
});

describe('montagem da NFC-e', () => {
  const payload = buildNfcePayload(venda) as any;

  it('identifica o emitente e a série do terminal', () => {
    expect(payload.cnpj_emitente).toBe('12345678000190');
    expect(payload.serie).toBe(1);
  });

  it('marca a operação como presencial', () => {
    expect(payload.presenca_comprador).toBe('1');
  });

  it('leva o CPF quando o cliente pediu na nota', () => {
    expect(payload.cpf_destinatario).toBe('11144477735');
  });

  it('omite o destinatário quando não há CPF', () => {
    const semCpf = buildNfcePayload({ ...venda, customerDocument: null }) as any;
    expect(semCpf.cpf_destinatario).toBeUndefined();
  });

  it('descreve o item com NCM, CFOP e quantidade', () => {
    expect(payload.items[0]).toMatchObject({
      numero_item: 1,
      codigo_produto: '10301',
      codigo_ncm: '21050010',
      cfop: '5102',
      quantidade_comercial: 2,
      valor_unitario_comercial: 34.9,
      valor_bruto: 69.8,
    });
  });

  it('aplica a tributação do Simples nos itens', () => {
    expect(payload.items[0].icms_situacao_tributaria).toBe('102');
    expect(payload.items[0].pis_situacao_tributaria).toBe('07');
  });

  it('traduz o meio de pagamento e a bandeira para os códigos da nota', () => {
    expect(payload.formas_pagamento[0]).toEqual({
      forma_pagamento: '04',
      valor_pagamento: 78.8,
      bandeira_operadora: '01',
    });
  });

  it('mapeia dinheiro e Pix', () => {
    const dinheiro = buildNfcePayload({
      ...venda,
      payments: [{ method: 'cash', amountCents: 7880 }],
    }) as any;
    expect(dinheiro.formas_pagamento[0].forma_pagamento).toBe('01');

    const pix = buildNfcePayload({ ...venda, payments: [{ method: 'pix', amountCents: 7880 }] }) as any;
    expect(pix.formas_pagamento[0].forma_pagamento).toBe('17');
  });

  it('separa desconto do valor de produtos', () => {
    const comDesconto = buildNfcePayload({ ...venda, discountCents: 880, totalCents: 7000 }) as any;
    expect(comDesconto.valor_produtos).toBe(78.8);
    expect(comDesconto.valor_desconto).toBe(8.8);
    expect(comDesconto.valor_total).toBe(70);
  });
});

describe('leitura da resposta', () => {
  const base = 'https://homologacao.focusnfe.com.br';

  it('reconhece a nota autorizada e monta as URLs completas', () => {
    const result = parseFocusResponse(
      {
        status: 'autorizado',
        chave_nfe: `NFe${'3'.repeat(44)}`,
        numero: '1042',
        protocolo: '135260000123456',
        caminho_xml_nota_fiscal: '/arquivos/nota.xml',
        caminho_danfe: '/arquivos/nota.pdf',
        qrcode_url: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=x',
      },
      base,
      'ref-1',
    );

    expect(result.status).toBe('authorized');
    expect(result.accessKey).toBe('3'.repeat(44));
    expect(result.number).toBe(1042);
    expect(result.xmlUrl).toBe(`${base}/arquivos/nota.xml`);
    expect(result.qrCode).toContain('qrcode');
  });

  it('descarta chave de acesso fora dos 44 dígitos em vez de gravar torto', () => {
    // A coluna é CHAR(44): gravar 47 caracteres derrubava o webhook inteiro.
    expect(normalizeAccessKey(undefined)).toBeUndefined();
    expect(normalizeAccessKey('NFe' + '7'.repeat(44))).toBe('7'.repeat(44));
    expect(normalizeAccessKey('7'.repeat(44))).toBe('7'.repeat(44));
    expect(normalizeAccessKey('chave-curta')).toBeUndefined();
  });

  it('trata processamento em andamento como pendente, não como erro', () => {
    expect(parseFocusResponse({ status: 'processando_autorizacao' }, base, 'ref-2').status).toBe('processing');
  });

  it('classifica indisponibilidade da SEFAZ como reenviável', () => {
    const result = parseFocusResponse(
      { status: 'erro_autorizacao', status_sefaz: '108', mensagem_sefaz: 'Serviço paralisado momentaneamente' },
      base,
      'ref-3',
    );
    expect(result.status).toBe('rejected');
    expect(result.rejection?.retryable).toBe(true);
  });

  it('classifica erro de cadastro como definitivo, para alguém corrigir', () => {
    const result = parseFocusResponse(
      { status: 'erro_autorizacao', status_sefaz: '778', mensagem_sefaz: 'NCM inválido' },
      base,
      'ref-4',
    );
    expect(result.rejection?.retryable).toBe(false);
    expect(result.rejection?.message).toContain('NCM inválido');
  });

  it('junta os erros de validação da própria Focus na mensagem', () => {
    const result = parseFocusResponse(
      {
        codigo: 'requisicao_invalida',
        mensagem: 'Requisição inválida',
        erros: [{ campo: 'items[0].codigo_ncm', mensagem: 'não pode ficar em branco' }],
      },
      base,
      'ref-5',
    );
    expect(result.rejection?.message).toContain('codigo_ncm');
    expect(result.rejection?.message).toContain('não pode ficar em branco');
  });
});
