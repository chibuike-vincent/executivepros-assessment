import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { IdempotencyConflictError } from '../../src/errors/app-error';
import { FilePaymentRepository } from '../../src/repositories/payment-repository';
import { PaymentService } from '../../src/services/payment-service';

describe('PaymentService idempotency', () => {
  async function createService() {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'payment-service-'));
    return new PaymentService(
      new FilePaymentRepository(path.join(dir, 'payments.json')),
    );
  }

  const payload = {
    amount: 2500,
    currency: 'NGN' as const,
    merchantRef: 'order-42',
  };

  it('returns the original payment for a matching replay', async () => {
    const service = await createService();
    const first = await service.create(payload);
    const replay = await service.create(payload);

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.payment.id).toBe(first.payment.id);
  });

  it('conflicts when the same merchantRef is reused with a different amount', async () => {
    const service = await createService();
    await service.create(payload);

    await expect(
      service.create({ ...payload, amount: 9999 }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});
