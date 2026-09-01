import { describe, expect, it } from 'vitest';
import { saleSchema } from './sale';
import { isValidCpf } from './primitives';

const baseSale = {
  id: '01927f3e-8c4a-7bd2-9f1e-3a5c8d2e4b71',
  sessionId: '01927f3e-2222-7000-8000-000000000002',
  operatorId: '01927f3e-3333-7000-8000-000000000003',
  occurredAt: '2026-09-14T14:32:07-03:00',
  items: [
    {
      lineNumber: 1,
      skuId: '01927f3e-4444-7000-8000-000000000004',
      description: 'Pote 500ml Napolitano',
      quantity: '2',
      unit: 'UN' as const,
      unitPriceCents: 2290,
      discountCents: 0,
      totalCents: 4580,
    },
  ],
  payments: [{ method: 'debit' as const, amountCents: 4580, changeCents: 0, installments: 1 }],
  grossCents: 4580,
  discountCents: 0,
  totalCents: 4580,
};

describe('validação da venda', () => {
  it('aceita uma venda coerente', () => {
    expect(saleSchema.safeParse(baseSale).success).toBe(true);
  });

  it('recusa venda cujo total não bate com os itens', () => {
    expect(saleSchema.safeParse({ ...baseSale, totalCents: 9999 }).success).toBe(false);
  });

  it('recusa venda cujos pagamentos não liquidam o total', () => {
    const result = saleSchema.safeParse({
      ...baseSale,
      payments: [{ method: 'cash' as const, amountCents: 1000, changeCents: 0, installments: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('aceita pagamento em dinheiro com troco', () => {
    const result = saleSchema.safeParse({
      ...baseSale,
      payments: [{ method: 'cash' as const, amountCents: 5000, changeCents: 420, installments: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it('aceita pagamento dividido entre maquineta e dinheiro', () => {
    const result = saleSchema.safeParse({
      ...baseSale,
      payments: [
        { method: 'credit' as const, amountCents: 3000, changeCents: 0, cardBrand: 'visa', installments: 1 },
        { method: 'cash' as const, amountCents: 1580, changeCents: 0, installments: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('recusa venda sem item', () => {
    expect(saleSchema.safeParse({ ...baseSale, items: [] }).success).toBe(false);
  });
});

describe('CPF na nota', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
  });
});
