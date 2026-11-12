import logger from '../config/logger';
import { IdempotencyConflictError, ValidationError } from '../errors/app-error';
import {
  DuplicateMerchantRefError,
  PaymentNotFoundError,
  StalePaymentError,
} from '../repositories/errors';
import type { FilePaymentRepository } from '../repositories/payment-repository';
import type { PaymentPatch } from '../repositories/payment-repository';
import {
  buildPayment,
  type NewPayment,
  type Payment,
  type PaymentStatus,
} from '../schemas/payment';
import type { JobEnqueue } from '../jobs/payment-job-queue';
import { assertTransition, isClientStatus } from './status-machine';

export type CreatePaymentResult = {
  payment: Payment;
  created: boolean;
};

export class PaymentService {
  private jobs: JobEnqueue | undefined;

  constructor(private readonly payments: FilePaymentRepository) {}

  attachJobQueue(jobs: JobEnqueue): void {
    this.jobs = jobs;
  }

  async create(input: NewPayment): Promise<CreatePaymentResult> {
    const existing = await this.payments.getByMerchantRef(input.merchantRef);
    if (existing) {
      this.assertIdempotentReplay(existing, input);
      return { payment: existing, created: false };
    }

    try {
      const payment = await this.payments.create(buildPayment(input));
      logger.info(
        { paymentId: payment.id, merchantRef: payment.merchantRef },
        'Payment created',
      );
      this.jobs?.enqueue(payment.id);
      return { payment, created: true };
    } catch (err) {
      if (err instanceof DuplicateMerchantRefError) {
        const raced = await this.payments.getByMerchantRef(input.merchantRef);
        if (!raced) {
          throw err;
        }

        this.assertIdempotentReplay(raced, input);
        return { payment: raced, created: false };
      }

      throw err;
    }
  }

  async getById(id: string): Promise<Payment> {
    const payment = await this.payments.getById(id);
    if (!payment) {
      throw new PaymentNotFoundError(id);
    }

    return payment;
  }

  async list(status?: PaymentStatus): Promise<Payment[]> {
    const payments = await this.payments.list();
    if (!status) {
      return payments;
    }

    return payments.filter((payment) => payment.status === status);
  }

  async updateStatus(
    id: string,
    nextStatus: PaymentStatus,
    extra?: PaymentPatch,
  ): Promise<Payment> {
    return this.transition(id, nextStatus, extra);
  }

  async cancel(id: string): Promise<Payment> {
    return this.transition(id, 'cancelled');
  }

  async applyClientStatus(id: string, nextStatus: PaymentStatus): Promise<Payment> {
    if (!isClientStatus(nextStatus)) {
      throw new ValidationError(
        'Clients may only set status to cancelled',
        { allowed: ['cancelled'] },
      );
    }

    return this.cancel(id);
  }

  private async transition(
    id: string,
    nextStatus: PaymentStatus,
    extra?: PaymentPatch,
  ): Promise<Payment> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.getById(id);

      if (current.status === nextStatus) {
        return current;
      }

      assertTransition(current.status, nextStatus);

      try {
        const updated = await this.payments.update(id, current.version, {
          status: nextStatus,
          ...extra,
        });
        logger.info(
          {
            paymentId: updated.id,
            from: current.status,
            to: updated.status,
            version: updated.version,
          },
          'Payment status updated',
        );
        return updated;
      } catch (err) {
        if (err instanceof StalePaymentError && attempt < 2) {
          continue;
        }

        throw err;
      }
    }

    throw new StalePaymentError(id, 0);
  }

  private assertIdempotentReplay(existing: Payment, input: NewPayment): void {
    const samePayload =
      existing.amount === input.amount &&
      existing.currency === input.currency &&
      existing.customerEmail === input.customerEmail &&
      existing.paymentMethodToken === input.paymentMethodToken;

    if (!samePayload) {
      throw new IdempotencyConflictError(input.merchantRef);
    }
  }
}
