import { buildPayment, newPaymentSchema } from '../../src/schemas/payment';

describe('payment schema', () => {
  it('accepts a valid create payload', () => {
    const parsed = newPaymentSchema.parse({
      amount: 100,
      currency: 'USD',
      merchantRef: 'order-1',
    });

    expect(parsed.amount).toBe(100);
  });

  it('rejects non-positive amounts', () => {
    const result = newPaymentSchema.safeParse({
      amount: 0,
      currency: 'NGN',
      merchantRef: 'order-1',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported currencies', () => {
    const result = newPaymentSchema.safeParse({
      amount: 100,
      currency: 'CAD',
      merchantRef: 'order-1',
    });

    expect(result.success).toBe(false);
  });

  it('builds a pending payment with a uuid and version 1', () => {
    const payment = buildPayment({
      amount: 1500,
      currency: 'NGN',
      merchantRef: 'order-9',
    });

    expect(payment.status).toBe('pending');
    expect(payment.version).toBe(1);
    expect(payment.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
