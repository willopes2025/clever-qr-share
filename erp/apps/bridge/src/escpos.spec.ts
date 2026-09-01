import { describe, expect, it } from 'vitest';
import { EscPosBuilder, encodeLatin } from './escpos';

describe('comandos ESC/POS', () => {
  it('começa reiniciando a impressora e fixando a página de código', () => {
    const bytes = new EscPosBuilder().init().build();
    expect([...bytes.subarray(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...bytes.subarray(2, 5)]).toEqual([0x1b, 0x74, 19]);
  });

  it('termina o cupom com avanço e corte', () => {
    const bytes = new EscPosBuilder().cut().build();
    expect([...bytes.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('manda o pulso da gaveta pelo pino configurado', () => {
    expect([...new EscPosBuilder().openDrawer(2).build()]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    expect([...new EscPosBuilder().openDrawer(5).build()]).toEqual([0x1b, 0x70, 0x01, 0x19, 0xfa]);
  });

  it('liga e desliga o negrito em volta do texto', () => {
    const bytes = new EscPosBuilder().bold(true).text('TOTAL').bold(false).build();
    expect([...bytes.subarray(0, 3)]).toEqual([0x1b, 0x45, 1]);
    expect([...bytes.subarray(-3)]).toEqual([0x1b, 0x45, 0]);
  });
});

describe('acentuação', () => {
  it('preserva acento em Latin-1, que é o que a impressora entende', () => {
    const bytes = encodeLatin('Ação');
    expect(bytes.toString('latin1')).toBe('Ação');
  });

  it('descarta o que não existe na tabela em vez de imprimir lixo', () => {
    expect(encodeLatin('Sorvete 😀 de coco').toString('latin1')).toBe('Sorvete  de coco');
  });

  it('tira o acento de caractere fora da tabela, quando dá', () => {
    // 'ẽ' não existe em Latin-1, mas vira 'e' em vez de sumir.
    expect(encodeLatin('cafẽ').toString('latin1')).toBe('cafe');
  });
});
