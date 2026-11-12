import request from 'supertest';
import { createTestApp } from '../helpers/app';

describe('OpenAPI docs', () => {
  it('serves the OpenAPI document', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const response = await request(app).get('/docs/openapi.json').expect(200);

    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe('Payment Processing Simulation');
    expect(response.body.paths['/payments']).toBeDefined();
    expect(response.body.paths['/health']).toBeDefined();
  });

  it('serves Swagger UI', async () => {
    const { app } = await createTestApp({ processPayments: false });

    const response = await request(app).get('/docs/').expect(200);

    expect(response.text).toContain('swagger-ui');
  });
});
