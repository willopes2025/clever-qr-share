import { describe, expect, it } from 'vitest';
import { center, groupAccessKey, money, renderReceipt, spread, truncate, type ReceiptData } from './receipt';

const venda: ReceiptData = {
  store: 'Quiosque Shopping Norte',
  cnpj: '12345678000190',
  terminal: 'PDV1',
  operator: 'Camila',
  occurredAt: new Date('2026-09-14T19:32:00-03:00'),
  items: [
    { description: 'Pote 1L Chocolate Belga', quantity: 2, unitPriceCents: 3490, totalCents: 6980 },
    { description: 'Casquinha', quantity: 1, unitPriceCents: 900, totalCents: 900 },
  ],
  totalCents: 7880,
  payments: [{ method: 'debit', amountCents: 7880, cardBrand: 'visa' }],
};

describe('formatação de valores', () => {
  it('escreve dinheiro no padrão brasileiro, sem símbolo', () => {
    expect(money(7880)).toBe('78,80');
    expect(money(123456789)).toBe('1.234.567,89');
  });
});

describe('alinhamento em colunas fixas', () => {
  it('empurra o valor para a direita da linha', () => {
    const line = spread('TOTAL', '78,80', 48);
    expect(line).toHaveLength(48);
    expect(line.endsWith('78,80')).toBe(true);
  });

  it('centraliza respeitando a largura do papel', () => {
    expect(center('SOUL', 10)).toBe('   SOUL');
  });

  it('corta descrição que não cabe, sem quebrar a coluna', () => {
    expect(truncate('Pote 1L Chocolate Belga com granola', 20)).toHaveLength(20);
  });

  it('não deixa rótulo longo empurrar o valor para fora', () => {
    const line = spread('Pote 1L Chocolate Belga edicao especial', '1.234,56', 32);
    expect(line).toHaveLength(32);
    expect(line.endsWith('1.234,56')).toBe(true);
  });
});

describe('cupom', () => {
  it('mostra loja, itens, total e forma de pagamento', () => {
    const lines = renderReceipt(venda);
    const texto = lines.join('\n');
    expect(texto).toContain('Quiosque Shopping Norte');
    expect(texto).toContain('12.345.678/0001-90');
    expect(texto).toContain('Pote 1L Chocolate Belga');
    expect(texto).toContain('2 x 34,90');
    expect(texto).toContain('Cartao debito (visa)');
    expect(lines.some((line) => line.startsWith('TOTAL') && line.endsWith('78,80'))).toBe(true);
  });

  it('avisa que é comprovante não fiscal enquanto a nota não saiu', () => {
    const texto = renderReceipt(venda).join('\n');
    expect(texto).toContain('COMPROVANTE DE VENDA');
    expect(texto).toContain('Documento nao fiscal');
  });

  it('imprime a chave de acesso quando a nota já foi autorizada', () => {
    const texto = renderReceipt({
      ...venda,
      fiscal: { accessKey: '3'.repeat(44), number: 1042, series: 1 },
    }).join('\n');
    expect(texto).toContain('NFC-e 1042');
    expect(texto).not.toContain('Documento nao fiscal');
  });

  it('mostra o troco quando houve pagamento em dinheiro', () => {
    const texto = renderReceipt({
      ...venda,
      payments: [{ method: 'cash', amountCents: 10000, changeCents: 2120 }],
    }).join('\n');
    expect(texto).toContain('Troco');
    expect(texto).toContain('21,20');
  });

  it('respeita papel estreito de 58mm', () => {
    const lines = renderReceipt(venda, 32);
    expect(lines.every((line) => line.length <= 32)).toBe(true);
  });
});

describe('chave de acesso', () => {
  it('sai em grupos de quatro para dar para conferir', () => {
    const linhas = groupAccessKey('1'.repeat(44), 48);
    expect(linhas.join(' ').replace(/ /g, '')).toHaveLength(44);
    expect(linhas[0]).toMatch(/^(\d{4} )+\d{4}$/);
  });
});
