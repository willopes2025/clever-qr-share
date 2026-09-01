import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './primitives';

export const heartbeatSchema = z.object({
  terminalId: uuidSchema,
  appVersion: z.string(),
  bridgeVersion: z.string().optional(),
  pendingSales: z.number().int().nonnegative(),
  printerOk: z.boolean().nullable(),
  lastSaleAt: isoDateTimeSchema.nullable(),
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const terminalAlertKinds = [
  'offline',
  'unsynced_sales',
  'fiscal_stuck',
  'printer_down',
  'cash_open_after_hours',
] as const;
export type TerminalAlertKind = (typeof terminalAlertKinds)[number];
