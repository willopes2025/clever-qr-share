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
import { resolveItemTax } from '../tax-rules';

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
      cest: '23.001.00',
      cfop: null,
      origin: 0,
      gtin: '7896543210012',
      unit: 'UN',
      quantity: 2,
      unitPriceCents: 3490,
      totalCents: 6980,
      discountCents: 0,
      tax: resolveItemTax({ crt: 1, cest: '23.001.00', cfop: null, rules: null }),
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
      // O pote é de substituição tributária, então o CFOP de venda é 5405.
      cfop: '5405',
      quantidade_comercial: 2,
      valor_unitario_comercial: 34.9,
      valor_bruto: 69.8,
    });
  });

  it('aplica a tributação do Simples nos itens', () => {
    // CSOSN 500: o ICMS deste pote já foi recolhido pela indústria.
    expect(payload.items[0].icms_situacao_tributaria).toBe('500');
    // 49 — outras operações de saída, que é o lançamento de quem recolhe
    // PIS/COFINS dentro da guia única do Simples.
    expect(payload.items[0].pis_situacao_tributaria).toBe('49');
  });

  it('traduz o meio de pagamento e a bandeira para os códigos da nota', () => {
    expect(payload.formas_pagamento[0]).toEqual({
      forma_pagamento: '04',
      valor_pagamento: 78.8,
      bandeira_operadora: '01',
      // 2 — pagamento não integrado: a maquineta do quiosque não fala com o PDV.
      tipo_integracao: '2',
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

describe('substituição tributária no payload', () => {
  it('manda o CEST sem pontuação, como a SEFAZ espera', () => {
    const payload = buildNfcePayload(venda) as any;
    expect(payload.items[0].cest).toBe('2300100');
  });

  it('usa a tributação resolvida do item, não o padrão do regime', () => {
    const payload = buildNfcePayload(venda) as any;
    expect(payload.items[0].icms_situacao_tributaria).toBe('500');
    expect(payload.items[0].cfop).toBe('5405');
  });

  it('omite o CEST do item que não é de substituição tributária', () => {
    const agua: FiscalIssueInput = {
      ...venda,
      items: [
        {
          ...venda.items[0]!,
          description: 'Água mineral 500ml',
          ncm: '22011000',
          cest: null,
          tax: resolveItemTax({ crt: 1, cest: null, cfop: null, rules: null }),
        },
      ],
    };
    const payload = buildNfcePayload(agua) as any;
    expect(payload.items[0].cest).toBeUndefined();
    expect(payload.items[0].icms_situacao_tributaria).toBe('102');
    expect(payload.items[0].cfop).toBe('5102');
  });
});

describe('troco', () => {
  // Cliente entrega R$ 100 numa venda de R$ 69,80. Mandar 100 como valor pago
  // contra um total de 69,80 é rejeição na certa: os dois têm de fechar.
  const comTroco: FiscalIssueInput = {
    ...venda,
    payments: [{ method: 'cash', amountCents: 10000, changeCents: 3020 }],
    totalCents: 6980,
  };

  it('declara o troco no total da nota', () => {
    expect((buildNfcePayload(comTroco) as any).valor_troco).toBe(30.2);
  });

  it('paga o líquido, não o que o cliente entregou', () => {
    const payload = buildNfcePayload(comTroco) as any;
    expect(payload.formas_pagamento[0].valor_pagamento).toBe(69.8);
    expect(payload.formas_pagamento[0].forma_pagamento).toBe('01');
  });

  it('não inventa campo de troco quando o pagamento é exato', () => {
    expect((buildNfcePayload(venda) as any).valor_troco).toBeUndefined();
  });
});

describe('identificação do item', () => {
  it('manda a origem que está no cadastro do produto', () => {
    const importado: FiscalIssueInput = {
      ...venda,
      items: [{ ...venda.items[0]!, origin: 1 }],
    };
    expect((buildNfcePayload(importado) as any).items[0].icms_origem).toBe('1');
  });

  it('manda o código de barras quando existe', () => {
    expect((buildNfcePayload(venda) as any).items[0].codigo_barras_comercial).toBe('7896543210012');
  });

  it('escreve SEM GTIN quando o produto não tem código de barras de verdade', () => {
    const semEan: FiscalIssueInput = { ...venda, items: [{ ...venda.items[0]!, gtin: null }] };
    const payload = buildNfcePayload(semEan) as any;
    expect(payload.items[0].codigo_barras_comercial).toBe('SEM GTIN');
    expect(payload.items[0].codigo_barras_tributavel).toBe('SEM GTIN');
  });
});

describe('destinatário e observação', () => {
  it('marca o consumidor como não contribuinte quando o CPF vai na nota', () => {
    const payload = buildNfcePayload(venda) as any;
    expect(payload.cpf_destinatario).toBe('11144477735');
    expect(payload.indicador_inscricao_estadual_destinatario).toBe('9');
  });

  it('não manda destinatário nenhum quando o cliente não pede CPF', () => {
    const payload = buildNfcePayload({ ...venda, customerDocument: null }) as any;
    expect(payload.cpf_destinatario).toBeUndefined();
    expect(payload.indicador_inscricao_estadual_destinatario).toBeUndefined();
  });

  it('inclui a observação do Simples Nacional e a omite no regime normal', () => {
    expect((buildNfcePayload(venda) as any).informacoes_adicionais_contribuinte).toContain(
      'Simples Nacional',
    );
    const normal = buildNfcePayload({
      ...venda,
      issuer: { ...venda.issuer, crt: 3 },
    }) as any;
    expect(normal.informacoes_adicionais_contribuinte).toBeUndefined();
  });
});
