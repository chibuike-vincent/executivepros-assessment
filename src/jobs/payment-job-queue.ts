import logger from '../config/logger';
import { IllegalTransitionError } from '../errors/app-error';
import { PaymentNotFoundError } from '../repositories/errors';
import type { PaymentService } from '../services/payment-service';
import type { PaymentProcessor } from './processor';

export type JobEnqueue = {
  enqueue(paymentId: string): void;
};

export type PaymentJobQueueOptions = {
  paymentService: PaymentService;
  processor: PaymentProcessor;
  concurrency: number;
  maxAttempts: number;
};

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export class PaymentJobQueue implements JobEnqueue {
  private readonly paymentService: PaymentService;
  private readonly processor: PaymentProcessor;
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private readonly inflight = new Set<string>();
  private readonly pendingRetry = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private readonly idleWaiters: Array<() => void> = [];
  private stopped = false;
  private running = 0;

  constructor(options: PaymentJobQueueOptions) {
    this.paymentService = options.paymentService;
    this.processor = options.processor;
    this.concurrency = options.concurrency;
    this.maxAttempts = options.maxAttempts;
  }

  enqueue(paymentId: string): void {
    if (this.stopped) {
      logger.warn({ paymentId }, 'Ignoring enqueue after shutdown');
      return;
    }

    if (this.queued.has(paymentId) || this.inflight.has(paymentId)) {
      return;
    }

    this.queued.add(paymentId);
    this.queue.push(paymentId);
    this.pump();
  }

  async recover(): Promise<void> {
    const payments = await this.paymentService.list();
    const recoverable = payments.filter(
      (payment) => payment.status === 'pending' || payment.status === 'processing',
    );

    logger.info(
      { count: recoverable.length },
      'Re-queuing unfinished payments after startup',
    );

    for (const payment of recoverable) {
      this.enqueue(payment.id);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.queue.length = 0;
    this.queued.clear();
    await this.waitForIdle();
  }

  waitForIdle(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private pump(): void {
    while (
      !this.stopped &&
      this.running < this.concurrency &&
      this.queue.length > 0
    ) {
      const paymentId = this.queue.shift();
      if (!paymentId) {
        break;
      }

      this.queued.delete(paymentId);
      this.inflight.add(paymentId);
      this.running += 1;

      void this.run(paymentId).finally(() => {
        this.inflight.delete(paymentId);
        this.running -= 1;

        if (this.pendingRetry.delete(paymentId) && !this.stopped) {
          this.enqueue(paymentId);
        }

        this.pump();
        this.notifyIdle();
      });
    }

    this.notifyIdle();
  }

  private notifyIdle(): void {
    if (this.running !== 0 || this.queue.length !== 0) {
      return;
    }

    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }

  private async run(paymentId: string): Promise<void> {
    const attempt = (this.attempts.get(paymentId) ?? 0) + 1;
    this.attempts.set(paymentId, attempt);

    try {
      await this.processPayment(paymentId);
      this.attempts.delete(paymentId);
    } catch (err) {
      if (err instanceof IllegalTransitionError || err instanceof PaymentNotFoundError) {
        logger.warn({ err, paymentId }, 'Skipping payment job');
        this.attempts.delete(paymentId);
        return;
      }

      logger.error({ err, paymentId, attempt }, 'Payment processor job failed');

      if (!this.stopped && attempt < this.maxAttempts) {
        this.pendingRetry.add(paymentId);
        return;
      }

      await this.failPayment(paymentId, 'PROCESSOR_UNAVAILABLE');
      this.attempts.delete(paymentId);
    }
  }

  private async processPayment(paymentId: string): Promise<void> {
    const payment = await this.paymentService.getById(paymentId);

    if (TERMINAL_STATUSES.has(payment.status)) {
      logger.info({ paymentId, status: payment.status }, 'Skipping terminal payment job');
      return;
    }

    if (payment.status === 'pending') {
      await this.paymentService.updateStatus(paymentId, 'processing');
    }

    const current = await this.paymentService.getById(paymentId);
    if (current.status !== 'processing') {
      logger.info({ paymentId, status: current.status }, 'Skipping non-processing payment job');
      return;
    }

    const result = await this.processor.process(current);

    if (result.outcome === 'succeeded') {
      await this.paymentService.updateStatus(paymentId, 'succeeded', {
        processorRef: result.processorRef,
      });
      return;
    }

    await this.paymentService.updateStatus(paymentId, 'failed', {
      failureReason: result.failureReason,
    });
  }

  private async failPayment(paymentId: string, failureReason: string): Promise<void> {
    try {
      const payment = await this.paymentService.getById(paymentId);
      if (TERMINAL_STATUSES.has(payment.status)) {
        return;
      }

      if (payment.status === 'pending') {
        await this.paymentService.updateStatus(paymentId, 'processing');
      }

      await this.paymentService.updateStatus(paymentId, 'failed', { failureReason });
    } catch (err) {
      logger.error({ err, paymentId }, 'Unable to mark payment as failed after processor errors');
    }
  }
}
