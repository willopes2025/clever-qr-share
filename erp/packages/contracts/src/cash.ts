import { z } from 'zod';
import { centsSchema, isoDateTimeSchema, uuidSchema } from './primitives';

export const openCashSessionSchema = z.object({
  terminalId: uuidSchema,
  openingFloatCents: centsSchema.nonnegative(),
  openedAt: isoDateTimeSchema.optional(),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const cashMovementSchema = z.object({
  kind: z.enum(['withdrawal', 'supply', 'reinforcement']),
  amountCents: centsSchema.positive(),
  reason: z.string().min(3, 'justificativa é obrigatória'),
});
export type CashMovementInput = z.infer<typeof cashMovementSchema>;

/** Conferência cega: o operador digita o contado sem ver o esperado. */
export const closeCashSessionSchema = z.object({
  counted: z.record(z.string(), centsSchema.nonnegative()),
  notes: z.string().optional(),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
