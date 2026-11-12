import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  paymentStoreSchema,
  type Payment,
  type PaymentStore,
} from '../schemas/payment';
import {
  DuplicateMerchantRefError,
  PaymentNotFoundError,
  PersistenceError,
  StalePaymentError,
} from './errors';

export type PaymentPatch = Partial<
  Pick<Payment, 'status' | 'failureReason' | 'processorRef'>
>;

const emptyStore = (): PaymentStore => ({ payments: [] });

export class FilePaymentRepository {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async getById(id: string): Promise<Payment | undefined> {
    return this.withLock(async () => {
      const store = await this.readStore();
      return store.payments.find((payment) => payment.id === id);
    });
  }

  async getByMerchantRef(merchantRef: string): Promise<Payment | undefined> {
    return this.withLock(async () => {
      const store = await this.readStore();
      return store.payments.find((payment) => payment.merchantRef === merchantRef);
    });
  }

  async list(): Promise<Payment[]> {
    return this.withLock(async () => {
      const store = await this.readStore();
      return [...store.payments];
    });
  }

  async create(payment: Payment): Promise<Payment> {
    return this.withLock(async () => {
      const store = await this.readStore();

      if (store.payments.some((existing) => existing.id === payment.id)) {
        throw new PersistenceError(`Payment ${payment.id} already exists`);
      }

      if (
        store.payments.some((existing) => existing.merchantRef === payment.merchantRef)
      ) {
        throw new DuplicateMerchantRefError(payment.merchantRef);
      }

      store.payments.push(payment);
      await this.writeStoreAtomically(store);
      return payment;
    });
  }

  async update(
    id: string,
    expectedVersion: number,
    patch: PaymentPatch,
  ): Promise<Payment> {
    return this.withLock(async () => {
      const store = await this.readStore();
      const index = store.payments.findIndex((payment) => payment.id === id);
      const existing = store.payments[index];

      if (index === -1 || !existing) {
        throw new PaymentNotFoundError(id);
      }

      if (existing.version !== expectedVersion) {
        throw new StalePaymentError(id, expectedVersion);
      }

      const updated: Payment = {
        ...existing,
        ...this.compactPatch(patch),
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
      };

      store.payments[index] = updated;
      await this.writeStoreAtomically(store);
      return updated;
    });
  }

  private compactPatch(patch: PaymentPatch): PaymentPatch {
    return Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as PaymentPatch;
  }

  private withLock<T>(work: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(work, work);
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readStore(): Promise<PaymentStore> {
    try {
      const contents = await fs.readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(contents);
      const result = paymentStoreSchema.safeParse(parsed);

      if (!result.success) {
        throw new PersistenceError(
          `Payment store at ${this.filePath} is invalid`,
          { cause: result.error },
        );
      }

      return {
        payments: [...result.data.payments],
      };
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return emptyStore();
      }

      if (err instanceof PersistenceError) {
        throw err;
      }

      if (err instanceof SyntaxError) {
        throw new PersistenceError(
          `Payment store at ${this.filePath} contains invalid JSON`,
          { cause: err },
        );
      }

      throw new PersistenceError(
        `Failed to read payment store at ${this.filePath}`,
        { cause: err },
      );
    }
  }

  private async writeStoreAtomically(store: PaymentStore): Promise<void> {
    const directory = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = `${JSON.stringify(store, null, 2)}\n`;

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, this.filePath);
    } catch (err) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw new PersistenceError(
        `Failed to write payment store at ${this.filePath}`,
        { cause: err },
      );
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
