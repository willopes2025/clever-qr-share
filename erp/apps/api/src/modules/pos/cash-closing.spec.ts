import { describe, expect, it } from 'vitest';
import { calculateExpected, closeCashSession } from './cash-closing';

const turno = {
  openingFloatCents: 10_000,
  salesByMethod: { cash: 45_000, debit: 82_000, credit: 31_000, pix: 12_000 },
  withdrawalsCents: 20_000,
  suppliesCents: 5_000,
  changeGivenCents: 3_500,
};

describe('esperado no fechamento', () => {
  it('soma fundo e suprimento e subtrai sangria e troco no dinheiro', () => {
    const expected = calculateExpected(turno);
    expect(expected.cash).toBe(45_000 + 10_000 + 5_000 - 20_000 - 3_500);
  });

  it('não mexe nos meios eletrônicos', () => {
    const expected = calculateExpected(turno);
    expect(expected.debit).toBe(82_000);
    expect(expected.pix).toBe(12_000);
  });
});

describe('conferência cega', () => {
  it('fecha sem diferença quando o contado bate', () => {
    const result = closeCashSession(turno, {
      cash: 36_500,
      debit: 82_000,
      credit: 31_000,
      pix: 12_000,
    });
    expect(result.differenceCents).toBe(0);
    expect(result.requiresJustification).toBe(false);
  });

  it('aponta a falta e exige justificativa', () => {
    const result = closeCashSession(turno, {
      cash: 36_000,
      debit: 82_000,
      credit: 31_000,
      pix: 12_000,
    });
    expect(result.differenceByMethod.cash).toBe(-500);
    expect(result.requiresJustification).toBe(true);
  });

  it('aponta sobra tanto quanto falta', () => {
    const result = closeCashSession(turno, {
      cash: 37_000,
      debit: 82_000,
      credit: 31_000,
      pix: 12_000,
    });
    expect(result.differenceCents).toBe(500);
  });

  it('trata meio de pagamento não contado como zero', () => {
    const result = closeCashSession(turno, { cash: 36_500 });
    expect(result.differenceByMethod.debit).toBe(-82_000);
  });
});
