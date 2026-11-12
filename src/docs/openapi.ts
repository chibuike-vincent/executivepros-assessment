export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Payment Processing Simulation',
    version: '1.0.0',
    description:
      'Node.js microservice that simulates asynchronous payment processing. Creates return immediately as pending; a background worker moves payments to succeeded or failed. Card numbers are not accepted — use a payment method token only.',
  },
  servers: [
    {
      url: 'http://127.0.0.1:4000',
      description: 'Local default',
    },
  ],
  tags: [
    { name: 'Health', description: 'Liveness' },
    { name: 'Payments', description: 'Create, inspect, and cancel payments' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service liveness',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
              },
            },
          },
        },
      },
    },
    '/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Create a payment',
        description:
          'Persists a pending payment and enqueues background processing. Replaying the same merchantRef (or Idempotency-Key) with the same payload returns the original payment with 200. A different payload with the same key returns 409.',
        operationId: 'createPayment',
        parameters: [
          { $ref: '#/components/parameters/IdempotencyKey' },
          { $ref: '#/components/parameters/RequestId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePaymentRequest' },
              examples: {
                naira: {
                  value: {
                    amount: 2500,
                    currency: 'NGN',
                    merchantRef: 'order-42',
                    customerEmail: 'buyer@example.com',
                    paymentMethodToken: 'tok_test_123',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Payment created and queued',
            headers: {
              Location: {
                schema: { type: 'string' },
                example: '/payments/8c24d884-ae1f-4461-a3f4-4eaf051597ae',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
          '200': {
            description: 'Idempotent replay of an existing payment',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
          '413': { $ref: '#/components/responses/PayloadTooLarge' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
      get: {
        tags: ['Payments'],
        summary: 'List payments',
        operationId: 'listPayments',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { $ref: '#/components/schemas/PaymentStatus' },
          },
          { $ref: '#/components/parameters/RequestId' },
        ],
        responses: {
          '200': {
            description: 'Payment list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
    },
    '/payments/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get a payment by id',
        operationId: 'getPayment',
        parameters: [
          { $ref: '#/components/parameters/PaymentId' },
          { $ref: '#/components/parameters/RequestId' },
        ],
        responses: {
          '200': {
            description: 'Payment found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
      patch: {
        tags: ['Payments'],
        summary: 'Cancel a pending payment',
        description:
          'Clients may only set status to cancelled, and only from pending. Repeat cancels are a no-op. PUT is an alias of this operation.',
        operationId: 'cancelPayment',
        parameters: [
          { $ref: '#/components/parameters/PaymentId' },
          { $ref: '#/components/parameters/RequestId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePaymentRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment cancelled (or already cancelled)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
      put: {
        tags: ['Payments'],
        summary: 'Cancel a pending payment (alias of PATCH)',
        operationId: 'cancelPaymentPut',
        parameters: [
          { $ref: '#/components/parameters/PaymentId' },
          { $ref: '#/components/parameters/RequestId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePaymentRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment cancelled (or already cancelled)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
    },
  },
  components: {
    parameters: {
      PaymentId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        description:
          'Optional create key. If both this header and merchantRef are sent, they must match. Either one is sufficient.',
        schema: { type: 'string', minLength: 1, maxLength: 64 },
      },
      RequestId: {
        name: 'x-request-id',
        in: 'header',
        required: false,
        description: 'Correlation id. Generated if omitted. Echoed on every response.',
        schema: { type: 'string', maxLength: 128 },
      },
    },
    schemas: {
      PaymentStatus: {
        type: 'string',
        enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled'],
      },
      Currency: {
        type: 'string',
        enum: ['NGN', 'USD', 'GBP', 'EUR'],
      },
      CreatePaymentRequest: {
        type: 'object',
        required: ['amount', 'currency'],
        additionalProperties: false,
        properties: {
          amount: {
            type: 'integer',
            minimum: 1,
            description: 'Amount in minor units (kobo, cents).',
            example: 2500,
          },
          currency: { $ref: '#/components/schemas/Currency' },
          merchantRef: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            description: 'Idempotency key. Required unless Idempotency-Key is sent.',
          },
          customerEmail: { type: 'string', format: 'email' },
          paymentMethodToken: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            description: 'Tokenised payment method. Never send PAN or CVV.',
          },
        },
      },
      UpdatePaymentRequest: {
        type: 'object',
        required: ['status'],
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['cancelled'] },
        },
      },
      Payment: {
        type: 'object',
        required: [
          'id',
          'amount',
          'currency',
          'merchantRef',
          'status',
          'version',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          amount: { type: 'integer', minimum: 1 },
          currency: { $ref: '#/components/schemas/Currency' },
          merchantRef: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          paymentMethodToken: { type: 'string' },
          status: { $ref: '#/components/schemas/PaymentStatus' },
          failureReason: { type: 'string' },
          processorRef: { type: 'string' },
          version: { type: 'integer', minimum: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PaymentResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { $ref: '#/components/schemas/Payment' },
        },
      },
      PaymentListResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Payment' },
          },
        },
      },
      Health: {
        type: 'object',
        required: ['status', 'service', 'uptime', 'timestamp'],
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'payment-service' },
          uptime: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request',
                requestId: 'client-trace-1',
              },
            },
          },
        },
      },
      NotFound: {
        description: 'Payment not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'NOT_FOUND',
                message: 'Payment 00000000-0000-4000-8000-000000000000 was not found',
                requestId: 'client-trace-1',
              },
            },
          },
        },
      },
      Conflict: {
        description:
          'Idempotency conflict or illegal status transition',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              idempotency: {
                value: {
                  error: {
                    code: 'IDEMPOTENCY_CONFLICT',
                    message:
                      'Idempotency key order-42 was reused with a different payment payload',
                    requestId: 'client-trace-1',
                  },
                },
              },
              transition: {
                value: {
                  error: {
                    code: 'ILLEGAL_STATUS_TRANSITION',
                    message: 'Cannot transition payment from succeeded to cancelled',
                    requestId: 'client-trace-1',
                  },
                },
              },
            },
          },
        },
      },
      PayloadTooLarge: {
        description: 'JSON body exceeds 16kb',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request body exceeds the 16kb limit',
                requestId: 'client-trace-1',
              },
            },
          },
        },
      },
      Unavailable: {
        description: 'Payment store cannot be read or written',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Payment store is temporarily unavailable',
                requestId: 'client-trace-1',
              },
            },
          },
        },
      },
    },
  },
} as const;
