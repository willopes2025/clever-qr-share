import { describe, expect, it } from 'vitest';
import {
  CFOP_VENDA_INTERNA,
  CFOP_VENDA_INTERNA_ST,
  CSOSN_SEM_CREDITO,
  CSOSN_ST,
  CST_ST,
  CST_TRIBUTADA,
  hasSubstituicaoTributaria,
  isSimplesNacional,
  normalizeCest,
  parseTaxProfileRules,
  resolveItemTax,
} from './tax-rules';

const SIMPLES = 1;
const NORMAL = 3;

describe('regime', () => {
  it('trata CRT 1 e 2 como Simples Nacional e 3 como regime normal', () => {
    expect(isSimplesNacional(1)).toBe(true);
    expect(isSimplesNacional(2)).toBe(true);
    expect(isSimplesNacional(NORMAL)).toBe(false);
  });
});

describe('identificação da substituição tributária', () => {
  it('considera ST o produto que tem CEST cadastrado', () => {
    expect(hasSubstituicaoTributaria({ crt: SIMPLES, cest: '2300100', cfop: null, rules: null })).toBe(true);
  });

  it('não considera ST o produto sem CEST', () => {
    expect(hasSubstituicaoTributaria({ crt: SIMPLES, cest: null, cfop: null, rules: null })).toBe(false);
    expect(hasSubstituicaoTributaria({ crt: SIMPLES, cest: '   ', cfop: null, rules: null })).toBe(false);
  });

  it('deixa a regra do produto decidir contra o CEST, nos dois sentidos', () => {
    expect(
      hasSubstituicaoTributaria({
        crt: SIMPLES,
        cest: '2300100',
        cfop: null,
        rules: { substituicaoTributaria: false },
      }),
    ).toBe(false);
    expect(
      hasSubstituicaoTributaria({
        crt: SIMPLES,
        cest: null,
        cfop: null,
        rules: { substituicaoTributaria: true },
      }),
    ).toBe(true);
  });
});

describe('pote de sorvete — o item que define o quiosque', () => {
  // Sorvete industrializado chega ao quiosque com o ICMS já retido pela
  // indústria. Declarar CSOSN 102 aqui é dizer que o quiosque tributa de novo.
  it('sai com CSOSN 500 e CFOP 5405 no Simples Nacional', () => {
    const tax = resolveItemTax({ crt: SIMPLES, cest: '2300100', cfop: null, rules: null });
    expect(tax.icmsSituacao).toBe(CSOSN_ST);
    expect(tax.cfop).toBe(CFOP_VENDA_INTERNA_ST);
    expect(tax.substituicaoTributaria).toBe(true);
  });

  it('sai com CST 60 no regime normal', () => {
    const tax = resolveItemTax({ crt: NORMAL, cest: '2300100', cfop: null, rules: null });
    expect(tax.icmsSituacao).toBe(CST_ST);
    expect(tax.cfop).toBe(CFOP_VENDA_INTERNA_ST);
  });
});

describe('água mineral — item da mesma nota, sem ST', () => {
  it('sai com CSOSN 102 e CFOP 5102 no Simples', () => {
    const tax = resolveItemTax({ crt: SIMPLES, cest: null, cfop: null, rules: null });
    expect(tax.icmsSituacao).toBe(CSOSN_SEM_CREDITO);
    expect(tax.cfop).toBe(CFOP_VENDA_INTERNA);
    expect(tax.substituicaoTributaria).toBe(false);
  });

  it('sai com CST 00 no regime normal', () => {
    expect(resolveItemTax({ crt: NORMAL, cest: null, cfop: null, rules: null }).icmsSituacao).toBe(
      CST_TRIBUTADA,
    );
  });
});

describe('precedência', () => {
  it('a regra do perfil ganha do padrão do regime', () => {
    const tax = resolveItemTax({
      crt: SIMPLES,
      cest: '2300100',
      cfop: '5405',
      rules: { icmsSituacao: '900', cfop: '5102', pisSituacao: '07', cofinsSituacao: '07' },
    });
    expect(tax.icmsSituacao).toBe('900');
    expect(tax.cfop).toBe('5102');
    expect(tax.pisSituacao).toBe('07');
    expect(tax.cofinsSituacao).toBe('07');
  });

  it('o CFOP do cadastro do produto ganha do padrão, mas perde para a regra', () => {
    expect(resolveItemTax({ crt: SIMPLES, cest: null, cfop: '5405', rules: null }).cfop).toBe('5405');
    expect(
      resolveItemTax({ crt: SIMPLES, cest: null, cfop: '5405', rules: { cfop: '5102' } }).cfop,
    ).toBe('5102');
  });

  it('usa 49 em PIS/COFINS no Simples e 01 no regime normal', () => {
    expect(resolveItemTax({ crt: SIMPLES, cest: null, cfop: null, rules: null }).pisSituacao).toBe('49');
    expect(resolveItemTax({ crt: NORMAL, cest: null, cfop: null, rules: null }).cofinsSituacao).toBe('01');
  });
});

describe('leitura do perfil tributário gravado como Json', () => {
  it('aceita o que reconhece e descarta o resto', () => {
    expect(parseTaxProfileRules({ icmsSituacao: '500', lixo: 1, cfop: '  5405  ' })).toEqual({
      icmsSituacao: '500',
      cfop: '5405',
    });
  });

  it('devolve nulo para perfil vazio, ausente ou de tipo errado', () => {
    expect(parseTaxProfileRules(null)).toBeNull();
    expect(parseTaxProfileRules({})).toBeNull();
    expect(parseTaxProfileRules([1, 2])).toBeNull();
    expect(parseTaxProfileRules('500')).toBeNull();
    expect(parseTaxProfileRules({ icmsSituacao: 42 })).toBeNull();
  });
});

describe('CEST', () => {
  it('tira a pontuação do cadastro', () => {
    expect(normalizeCest('23.001.00')).toBe('2300100');
    expect(normalizeCest('2300100')).toBe('2300100');
  });

  it('ignora valor incompleto em vez de mandar lixo para a SEFAZ', () => {
    expect(normalizeCest('17011')).toBeUndefined();
    expect(normalizeCest('')).toBeUndefined();
    expect(normalizeCest(null)).toBeUndefined();
  });
});
