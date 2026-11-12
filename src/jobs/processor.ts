import { randomUUID } from 'node:crypto';
import type { Payment } from '../schemas/payment';

export type ProcessorResult =
  | { outcome: 'succeeded'; processorRef: string }
  | { outcome: 'failed'; failureReason: string };

export type PaymentProcessor = {
  process(payment: Payment): Promise<ProcessorResult>;
};

export type SimulatedProcessorOptions = {
  delayMs: number;
  failureRate: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class SimulatedPaymentProcessor implements PaymentProcessor {
  private readonly delayMs: number;
  private readonly failureRate: number;
  private readonly random: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: SimulatedProcessorOptions) {
    this.delayMs = options.delayMs;
    this.failureRate = options.failureRate;
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async process(payment: Payment): Promise<ProcessorResult> {
    await this.sleep(this.delayMs);

    if (this.random() < this.failureRate) {
      return {
        outcome: 'failed',
        failureReason: 'PROCESSOR_DECLINED',
      };
    }

    return {
      outcome: 'succeeded',
      processorRef: `sim_${payment.id.slice(0, 8)}_${randomUUID().slice(0, 8)}`,
    };
  }
}
