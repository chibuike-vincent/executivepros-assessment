import request from 'supertest';
import { createTestApp } from '../helpers/app';

describe('GET /health', () => {
  it('returns service liveness', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'payment-service',
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('echoes a client request id', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const response = await request(app)
      .get('/health')
      .set('x-request-id', 'client-trace-1')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-trace-1');
  });
});
