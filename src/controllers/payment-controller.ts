import type { Request, Response } from 'express';
import { ValidationError } from '../errors/app-error';
import type { PaymentService } from '../services/payment-service';
import {
  createPaymentBodySchema,
  idempotencyKeySchema,
  listPaymentsQuerySchema,
  paymentIdParamsSchema,
  updatePaymentBodySchema,
} from '../schemas/http';
import type { NewPayment } from '../schemas/payment';

function resolveMerchantRef(bodyRef: string | undefined, header: string | undefined): string {
  const headerKey = header ? idempotencyKeySchema.parse(header) : undefined;

  if (headerKey && bodyRef && headerKey !== bodyRef) {
    throw new ValidationError(
      'Idempotency-Key header must match merchantRef',
      { header: headerKey, merchantRef: bodyRef },
    );
  }

  const merchantRef = bodyRef ?? headerKey;
  if (!merchantRef) {
    throw new ValidationError('merchantRef or Idempotency-Key header is required');
  }

  return merchantRef;
}

export function createPaymentController(paymentService: PaymentService) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      const body = createPaymentBodySchema.parse(req.body);
      const merchantRef = resolveMerchantRef(
        body.merchantRef,
        req.header('Idempotency-Key'),
      );
      const input: NewPayment = {
        amount: body.amount,
        currency: body.currency,
        merchantRef,
        ...(body.customerEmail !== undefined
          ? { customerEmail: body.customerEmail }
          : {}),
        ...(body.paymentMethodToken !== undefined
          ? { paymentMethodToken: body.paymentMethodToken }
          : {}),
      };

      const { payment, created } = await paymentService.create(input);

      if (created) {
        res.status(201).location(`/payments/${payment.id}`).json({ data: payment });
        return;
      }

      res.status(200).json({ data: payment });
    },

    async list(req: Request, res: Response): Promise<void> {
      const query = listPaymentsQuerySchema.parse(req.query);
      const payments = await paymentService.list(query.status);
      res.status(200).json({ data: payments });
    },

    async getById(req: Request, res: Response): Promise<void> {
      const { id } = paymentIdParamsSchema.parse(req.params);
      const payment = await paymentService.getById(id);
      res.status(200).json({ data: payment });
    },

    async updateStatus(req: Request, res: Response): Promise<void> {
      const { id } = paymentIdParamsSchema.parse(req.params);
      const body = updatePaymentBodySchema.parse(req.body);
      const payment = await paymentService.applyClientStatus(id, body.status);
      res.status(200).json({ data: payment });
    },
  };
}
