import request from 'supertest';
import { createTestApp, paymentPayload } from '../helpers/app';

describe('payments API', () => {
  it('creates a pending payment and fetches it by id', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const created = await request(app)
      .post('/payments')
      .send(paymentPayload)
      .expect(201);

    expect(created.headers.location).toBe(`/payments/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({
      amount: 2500,
      currency: 'NGN',
      merchantRef: 'order-42',
      status: 'pending',
    });

    const fetched = await request(app)
      .get(`/payments/${created.body.data.id}`)
      .expect(200);

    expect(fetched.body.data.id).toBe(created.body.data.id);
  });

  it('replays an identical create as a 200 with the same id', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const first = await request(app).post('/payments').send(paymentPayload).expect(201);
    const replay = await request(app)
      .post('/payments')
      .set('Idempotency-Key', paymentPayload.merchantRef)
      .send(paymentPayload)
      .expect(200);

    expect(replay.body.data.id).toBe(first.body.data.id);
  });

  it('rejects idempotent reuse with a different payload', async () => {
    const { app } = await createTestApp({ processPayments: false });
    await request(app).post('/payments').send(paymentPayload).expect(201);

    const conflict = await request(app)
      .post('/payments')
      .send({ ...paymentPayload, amount: 9999 })
      .expect(409);

    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(conflict.body.error.requestId).toEqual(expect.any(String));
  });

  it('validates create input', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const response = await request(app)
      .post('/payments')
      .send({ amount: -1, currency: 'NGN', merchantRef: 'bad' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown payment and 400 for a bad id', async () => {
    const { app } = await createTestApp({ processPayments: false });

    await request(app)
      .get('/payments/00000000-0000-4000-8000-000000000000')
      .expect(404);

    await request(app).get('/payments/not-a-uuid').expect(400);
  });

  it('cancels a pending payment and is idempotent on repeat cancel', async () => {
    const { app } = await createTestApp({ processPayments: false });
    const created = await request(app)
      .post('/payments')
      .send(paymentPayload)
      .expect(201);

    const cancelled = await request(app)
      .patch(`/payments/${created.body.data.id}`)
      .send({ status: 'cancelled' })
      .expect(200);

    expect(cancelled.body.data.status).toBe('cancelled');

    await request(app)
      .put(`/payments/${created.body.data.id}`)
      .send({ status: 'cancelled' })
      .expect(200);
  });

  it('rejects client attempts to mark a payment succeeded', async () => {
    const { app } = await createTestApp({ processPayments: false });
    const created = await request(app)
      .post('/payments')
      .send(paymentPayload)
      .expect(201);

    await request(app)
      .patch(`/payments/${created.body.data.id}`)
      .send({ status: 'succeeded' })
      .expect(400);
  });

  it('processes a payment asynchronously to succeeded', async () => {
    const { app, jobQueue } = await createTestApp();
    const created = await request(app)
      .post('/payments')
      .send({ ...paymentPayload, merchantRef: 'async-ok' })
      .expect(201);

    expect(created.body.data.status).toBe('pending');
    await jobQueue.waitForIdle();

    const fetched = await request(app)
      .get(`/payments/${created.body.data.id}`)
      .expect(200);

    expect(fetched.body.data.status).toBe('succeeded');
    expect(fetched.body.data.processorRef).toBe('test-processor');
  });

  it('rejects cancelling a succeeded payment', async () => {
    const { app, jobQueue } = await createTestApp();
    const created = await request(app)
      .post('/payments')
      .send({ ...paymentPayload, merchantRef: 'async-lock' })
      .expect(201);

    await jobQueue.waitForIdle();

    const response = await request(app)
      .patch(`/payments/${created.body.data.id}`)
      .send({ status: 'cancelled' })
      .expect(409);

    expect(response.body.error.code).toBe('ILLEGAL_STATUS_TRANSITION');
  });

  it('records a processor decline', async () => {
    const { app, jobQueue } = await createTestApp({
      processor: {
        process: async () => ({
          outcome: 'failed',
          failureReason: 'PROCESSOR_DECLINED',
        }),
      },
    });

    const created = await request(app)
      .post('/payments')
      .send({ ...paymentPayload, merchantRef: 'async-fail' })
      .expect(201);

    await jobQueue.waitForIdle();

    const fetched = await request(app)
      .get(`/payments/${created.body.data.id}`)
      .expect(200);

    expect(fetched.body.data.status).toBe('failed');
    expect(fetched.body.data.failureReason).toBe('PROCESSOR_DECLINED');
  });
});
