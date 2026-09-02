import { describe, expect, it } from 'vitest';
import { businessDayRange, startOfBusinessDay } from './business-time';

const SP = 'America/Sao_Paulo';

describe('dia do negócio', () => {
  it('venda das 22h ainda pertence ao dia em que o quiosque vendeu', () => {
    // 2 de setembro, 22h em Brasília = 3 de setembro, 01h UTC. Pelo relógio do
    // servidor já é dia 3; para o quiosque, o expediente é o do dia 2.
    const vendaTarde = new Date('2026-09-03T01:00:00Z');
    const { start, end } = businessDayRange(vendaTarde, SP);

    expect(start.toISOString()).toBe('2026-09-02T03:00:00.000Z'); // 2/9 00:00 em SP
    expect(end.toISOString()).toBe('2026-09-03T03:00:00.000Z');
    expect(vendaTarde >= start && vendaTarde < end).toBe(true);
  });

  it('faturamento do começo do dia não some quando passa das 21h', () => {
    // A venda das 10h e a venda das 22h precisam cair na mesma janela.
    const manha = new Date('2026-09-02T13:00:00Z'); // 10h em SP
    const noite = new Date('2026-09-03T01:00:00Z'); // 22h em SP, mesmo dia útil
    const { start, end } = businessDayRange(noite, SP);

    expect(manha >= start && manha < end).toBe(true);
    expect(noite >= start && noite < end).toBe(true);
  });

  it('a janela tem 24 horas e encosta uma na outra sem buraco', () => {
    const { start, end } = businessDayRange(new Date('2026-09-02T13:00:00Z'), SP);
    expect(end.getTime() - start.getTime()).toBe(24 * 3_600_000);

    const anterior = businessDayRange(new Date(start.getTime() - 1), SP);
    expect(anterior.end.getTime()).toBe(start.getTime());
  });

  it('meia-noite em ponto no fuso do quiosque já é o dia novo', () => {
    const virada = new Date('2026-09-02T03:00:00Z'); // 00:00 em SP
    expect(startOfBusinessDay(virada, SP).toISOString()).toBe('2026-09-02T03:00:00.000Z');
  });

  it('fuso diferente muda a janela, para quiosque em outro estado', () => {
    const instante = new Date('2026-09-02T13:00:00Z');
    const sp = businessDayRange(instante, SP);
    const manaus = businessDayRange(instante, 'America/Manaus');
    expect(manaus.start.getTime()).toBe(sp.start.getTime() + 3_600_000);
  });
});
