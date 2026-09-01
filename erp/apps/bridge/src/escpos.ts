/**
 * Comandos ESC/POS.
 *
 * Impressora térmica não recebe texto puro: recebe bytes com comandos de
 * controle no meio. Montamos esses bytes à mão em vez de trazer uma biblioteca —
 * o conjunto que o cupom usa é pequeno, e o agente precisa ser leve e previsível
 * num computador de quiosque.
 */
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Alignment = 'left' | 'center' | 'right';

/** Página de código 858 (Latin-1 com €): é o que imprime acento em português. */
const CODEPAGE_LATIN = 19;

export class EscPosBuilder {
  private readonly chunks: number[] = [];

  /** Reinicia a impressora e ajusta a página de código antes de qualquer texto. */
  init(): this {
    return this.push(ESC, 0x40).push(ESC, 0x74, CODEPAGE_LATIN);
  }

  align(alignment: Alignment): this {
    const codes: Record<Alignment, number> = { left: 0, center: 1, right: 2 };
    return this.push(ESC, 0x61, codes[alignment]);
  }

  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }

  /** Dobra a altura e a largura — usado só no total, que precisa ser lido de longe. */
  doubleSize(on: boolean): this {
    return this.push(GS, 0x21, on ? 0x11 : 0x00);
  }

  text(value: string): this {
    return this.pushBytes(encodeLatin(value));
  }

  line(value = ''): this {
    return this.text(value).push(LF);
  }

  feed(lines = 1): this {
    return this.push(ESC, 0x64, lines);
  }

  /** Corte parcial: deixa um filete de papel, para o cupom não cair no chão. */
  cut(): this {
    return this.feed(4).push(GS, 0x56, 0x42, 0x00);
  }

  /**
   * Pulso na gaveta. O conector fica na impressora, então abrir a gaveta é um
   * comando de impressão — e é por isso que o Bridge cuida das duas coisas.
   */
  openDrawer(pin: 2 | 5 = 2): this {
    return this.push(ESC, 0x70, pin === 2 ? 0x00 : 0x01, 0x19, 0xfa);
  }

  build(): Buffer {
    return Buffer.from(this.chunks);
  }

  private push(...bytes: number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  private pushBytes(bytes: Buffer): this {
    this.chunks.push(...bytes);
    return this;
  }
}

/**
 * Converte para Latin-1, que é a tabela que a impressora entende.
 *
 * Acento comum do português está na tabela e sai como acento. O que não está —
 * emoji, símbolo de outro alfabeto — perde o acento e, se ainda assim não
 * couber, é descartado: melhor faltar um caractere que imprimir lixo no cupom.
 */
export function encodeLatin(value: string): Buffer {
  const printable = [...value]
    .map((char) => (isLatin1(char) ? char : stripAccents(char)))
    .map((char) => (isLatin1(char) ? char : ''))
    .join('');
  return Buffer.from(printable, 'latin1');
}

function isLatin1(char: string): boolean {
  return char.length === 1 && char.charCodeAt(0) <= 0xff;
}

function stripAccents(char: string): string {
  return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
