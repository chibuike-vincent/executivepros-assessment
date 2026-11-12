import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRuntime, type AppRuntime } from '../../src/app';
import { PaymentJobQueue } from '../../src/jobs/payment-job-queue';
import type { PaymentProcessor } from '../../src/jobs/processor';
import { FilePaymentRepository } from '../../src/repositories/payment-repository';
import { PaymentService } from '../../src/services/payment-service';

export type TestApp = AppRuntime & {
  dir: string;
};

const succeedingProcessor: PaymentProcessor = {
  process: async () => ({
    outcome: 'succeeded',
    processorRef: 'test-processor',
  }),
};

export async function createTestApp(options?: {
  processor?: PaymentProcessor;
  processPayments?: boolean;
  maxAttempts?: number;
}): Promise<TestApp> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'payment-tests-'));
  const paymentService = new PaymentService(
    new FilePaymentRepository(path.join(dir, 'payments.json')),
  );
  const processPayments = options?.processPayments ?? true;
  const processor = options?.processor ?? succeedingProcessor;

  if (!processPayments) {
    const { app, jobQueue } = createRuntime({ paymentService });
    return { app, paymentService, jobQueue, dir };
  }

  const jobQueue = new PaymentJobQueue({
    paymentService,
    processor,
    concurrency: 1,
    maxAttempts: options?.maxAttempts ?? 3,
  });

  const runtime = createRuntime({ paymentService, jobQueue, processor });
  return { ...runtime, dir };
}

export const paymentPayload = {
  amount: 2500,
  currency: 'NGN' as const,
  merchantRef: 'order-42',
  customerEmail: 'buyer@example.com',
};
