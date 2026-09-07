import { describe, expect, it } from 'vitest';
import { ALARME_MINUTOS, AVISO_MINUTOS, formatarEspera, minutosDeEspera } from './espera';

describe('minutosDeEspera', () => {
  it('não conta nada quando a fila está vazia', () => {
    expect(minutosDeEspera(null)).toBe(0);
  });

  it('mede a espera desde a entrada na fila', () => {
    const duasHorasAtras = new Date(Date.now() - 120 * 60_000).toISOString();
    expect(minutosDeEspera(duasHorasAtras)).toBe(120);
  });

  /**
   * Relógio de terminal atrasa e adianta — foi o que gerou a rejeição 703 aqui.
   * Uma data no futuro não pode virar espera negativa, que passaria por baixo
   * dos limites e apagaria o aviso justamente no terminal com problema.
   */
  it('trata data no futuro como espera zero, não negativa', () => {
    const daquiUmaHora = new Date(Date.now() + 60 * 60_000).toISOString();
    expect(minutosDeEspera(daquiUmaHora)).toBe(0);
  });
});

describe('formatarEspera', () => {
  it('mostra minutos na primeira hora', () => {
    expect(formatarEspera(0)).toBe('0 min');
    expect(formatarEspera(23)).toBe('23 min');
    expect(formatarEspera(59)).toBe('59 min');
  });

  it('vira hora e minuto a partir de uma hora, com o minuto sempre com dois dígitos', () => {
    expect(formatarEspera(60)).toBe('1h00');
    expect(formatarEspera(133)).toBe('2h13');
    // O caso que engana: 65 minutos é 1h05, não 1h5.
    expect(formatarEspera(65)).toBe('1h05');
  });

  it('vira dias depois de 24 horas — é o tamanho do problema que já aconteceu', () => {
    expect(formatarEspera(24 * 60)).toBe('1 dia');
    expect(formatarEspera(27 * 60)).toBe('1 dia e 3h');
    expect(formatarEspera(48 * 60)).toBe('2 dias');
    expect(formatarEspera(51 * 60)).toBe('2 dias e 3h');
  });
});

describe('limites', () => {
  /**
   * O aviso precisa vir antes do alarme, e os dois bem antes dos 45 minutos em
   * que se mediu a SEFAZ recusando por atraso. Se alguém subir esses números
   * sem pensar, o aviso chega quando a nota já está perdida.
   */
  it('avisa antes de alarmar, e alarma com folga do prazo real', () => {
    expect(AVISO_MINUTOS).toBeLessThan(ALARME_MINUTOS);
    expect(ALARME_MINUTOS).toBeLessThan(45);
  });
});
