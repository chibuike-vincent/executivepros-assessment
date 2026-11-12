import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DuplicateMerchantRefError,
  StalePaymentError,
} from '../../src/repositories/errors';
import { FilePaymentRepository } from '../../src/repositories/payment-repository';
import { buildPayment } from '../../src/schemas/payment';

describe('FilePaymentRepository', () => {
  async function createRepo() {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'payment-repo-'));
    return new FilePaymentRepository(path.join(dir, 'payments.json'));
  }

  it('persists and reloads a payment', async () => {
    const repo = await createRepo();
    const created = await repo.create(
      buildPayment({
        amount: 1500,
        currency: 'NGN',
        merchantRef: 'order-1',
      }),
    );

    await expect(repo.getById(created.id)).resolves.toMatchObject({
      id: created.id,
      merchantRef: 'order-1',
    });
    await expect(repo.getByMerchantRef('order-1')).resolves.toMatchObject({
      id: created.id,
    });
  });

  it('rejects duplicate merchant refs', async () => {
    const repo = await createRepo();
    await repo.create(
      buildPayment({ amount: 100, currency: 'USD', merchantRef: 'dup' }),
    );

    await expect(
      repo.create(
        buildPayment({ amount: 200, currency: 'USD', merchantRef: 'dup' }),
      ),
    ).rejects.toBeInstanceOf(DuplicateMerchantRefError);
  });

  it('rejects stale versions', async () => {
    const repo = await createRepo();
    const created = await repo.create(
      buildPayment({ amount: 100, currency: 'EUR', merchantRef: 'v1' }),
    );

    await repo.update(created.id, created.version, { status: 'processing' });

    await expect(
      repo.update(created.id, created.version, { status: 'succeeded' }),
    ).rejects.toBeInstanceOf(StalePaymentError);
  });
});
