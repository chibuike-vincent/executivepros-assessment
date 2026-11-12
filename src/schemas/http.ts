import { z } from 'zod';
import { newPaymentSchema, paymentStatusSchema } from './payment';

export const createPaymentBodySchema = newPaymentSchema
  .omit({ merchantRef: true })
  .extend({
    merchantRef: z.string().trim().min(1).max(64).optional(),
  });

export const paymentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listPaymentsQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
});

export const updatePaymentBodySchema = z
  .object({
    status: z.literal('cancelled'),
  })
  .strict();

export const idempotencyKeySchema = z.string().trim().min(1).max(64);

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
