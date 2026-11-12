export class PersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PersistenceError';
  }
}

export class PaymentNotFoundError extends Error {
  constructor(public readonly paymentId: string) {
    super(`Payment ${paymentId} was not found`);
    this.name = 'PaymentNotFoundError';
  }
}

export class DuplicateMerchantRefError extends Error {
  constructor(public readonly merchantRef: string) {
    super(`Payment with merchantRef ${merchantRef} already exists`);
    this.name = 'DuplicateMerchantRefError';
  }
}

export class StalePaymentError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly expectedVersion: number,
  ) {
    super(
      `Payment ${paymentId} was updated by another writer (expected version ${expectedVersion})`,
    );
    this.name = 'StalePaymentError';
  }
}
