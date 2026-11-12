import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const;

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

export const newPaymentSchema = z.object({
  amount: z.number().int().positive(),
  currency: currencySchema,
  merchantRef: z.string().trim().min(1).max(64),
  customerEmail: z.string().trim().email().optional(),
  paymentMethodToken: z.string().trim().min(1).max(128).optional(),
});

export const paymentSchema = newPaymentSchema.extend({
  id: z.string().uuid(),
  status: paymentStatusSchema,
  failureReason: z.string().min(1).max(256).optional(),
  processorRef: z.string().min(1).max(128).optional(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const paymentStoreSchema = z.object({
  payments: z.array(paymentSchema),
});

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type NewPayment = z.infer<typeof newPaymentSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type PaymentStore = z.infer<typeof paymentStoreSchema>;

export function buildPayment(input: NewPayment): Payment {
  const now = new Date().toISOString();

  return paymentSchema.parse({
    ...input,
    id: randomUUID(),
    status: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}
