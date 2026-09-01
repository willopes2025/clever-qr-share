import { z } from 'zod';
import { centsSchema, cpfSchema, isoDateTimeSchema, quantitySchema, uuidSchema } from './primitives';

export const paymentMethodSchema = z.enum(['cash', 'credit', 'debit', 'pix', 'voucher', 'store_credit']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const saleChannelSchema = z.enum(['pos', 'kiosk', 'delivery', 'table']);
export type SaleChannel = z.infer<typeof saleChannelSchema>;

export const saleItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  skuId: uuidSchema,
  description: z.string().min(1),
  quantity: quantitySchema,
  unit: z.enum(['UN', 'KG', 'L']),
  unitPriceCents: centsSchema.nonnegative(),
  discountCents: centsSchema.nonnegative().default(0),
  totalCents: centsSchema.nonnegative(),
  /** true quando o peso veio da balança, não da digitação */
  weighed: z.boolean().default(false),
});
export type SaleItemInput = z.infer<typeof saleItemSchema>;

export const salePaymentSchema = z.object({
  method: paymentMethodSchema,
  amountCents: centsSchema.positive(),
  changeCents: centsSchema.nonnegative().default(0),
  /** v1: maquininha avulsa, então o dado é informado pelo operador e não capturado */
  captured: z.boolean().default(false),
  acquirer: z.string().optional(),
  cardBrand: z.string().optional(),
  installments: z.number().int().min(1).max(24).default(1),
  nsu: z.string().optional(),
  authorizationCode: z.string().optional(),
});
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;

export const saleSchema = z
  .object({
    /** UUID gerado no PDV — é a chave de idempotência da sincronização */
    id: uuidSchema,
    sessionId: uuidSchema,
    operatorId: uuidSchema,
    customerDocument: cpfSchema.optional(),
    channel: saleChannelSchema.default('pos'),
    occurredAt: isoDateTimeSchema,
    items: z.array(saleItemSchema).min(1),
    payments: z.array(salePaymentSchema).min(1),
    grossCents: centsSchema.nonnegative(),
    discountCents: centsSchema.nonnegative().default(0),
    totalCents: centsSchema.positive(),
    clientVersion: z.string().optional(),
  })
  .superRefine((sale, ctx) => {
    const itemsTotal = sale.items.reduce((sum, item) => sum + item.totalCents, 0);
    if (itemsTotal - sale.discountCents !== sale.totalCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalCents'],
        message: 'total da venda não confere com a soma dos itens menos o desconto',
      });
    }
    const paid = sale.payments.reduce((sum, payment) => sum + payment.amountCents - payment.changeCents, 0);
    if (paid !== sale.totalCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payments'],
        message: 'soma dos pagamentos não liquida o total da venda',
      });
    }
  });
export type SaleInput = z.infer<typeof saleSchema>;

export const syncSalesRequestSchema = z.object({
  terminalId: uuidSchema,
  sales: z.array(saleSchema).min(1).max(50),
});
export type SyncSalesRequest = z.infer<typeof syncSalesRequestSchema>;

/** O que o PDV deve fazer com uma venda recusada pelo servidor. */
export type SyncRejectionAction = 'retry' | 'quarantine' | 'discard';

export interface SyncSaleResult {
  id: string;
  status: 'accepted' | 'duplicate';
  number: number;
  fiscal: { status: string; documentId: string | null };
}

export interface SyncSaleRejection {
  id: string;
  code: string;
  message: string;
  action: SyncRejectionAction;
}

export interface SyncSalesResponse {
  results: SyncSaleResult[];
  rejected: SyncSaleRejection[];
}
