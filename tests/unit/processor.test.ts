import { SimulatedPaymentProcessor } from '../../src/jobs/processor';
import { buildPayment } from '../../src/schemas/payment';

const payment = buildPayment({
  amount: 100,
  currency: 'USD',
  merchantRef: 'sim-1',
});

describe('SimulatedPaymentProcessor', () => {
  it('returns a processor reference on success', async () => {
    const processor = new SimulatedPaymentProcessor({
      delayMs: 0,
      failureRate: 0,
      random: () => 0.9,
      sleep: async () => undefined,
    });

    await expect(processor.process(payment)).resolves.toMatchObject({
      outcome: 'succeeded',
    });
  });

  it('declines when the random draw is below the failure rate', async () => {
    const processor = new SimulatedPaymentProcessor({
      delayMs: 0,
      failureRate: 1,
      random: () => 0,
      sleep: async () => undefined,
    });

    await expect(processor.process(payment)).resolves.toEqual({
      outcome: 'failed',
      failureReason: 'PROCESSOR_DECLINED',
    });
  });
});
