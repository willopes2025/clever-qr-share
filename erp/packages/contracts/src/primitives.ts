import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const centsSchema = z.number().int();
/** Quantidade com até 4 casas — peso de sorvete não cabe em inteiro. */
export const quantitySchema = z.string().regex(/^\d+(\.\d{1,4})?$/, 'quantidade inválida');
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const numbers = digits.split('').map(Number);
  for (const [length, position] of [[9, 10], [10, 11]] as const) {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += (numbers[i] as number) * (position - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== numbers[length]) return false;
  }
  return true;
}

export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
  .refine(isValidCpf, 'CPF inválido');
