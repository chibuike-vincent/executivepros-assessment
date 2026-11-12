import express, { type Express, type Request, type Response } from 'express';
import { config } from './config';
import logger from './config/logger';
import pinoHttp from 'pino-http';
import { errorHandler } from './middleware/error-handler';
import { FilePaymentRepository } from './repositories/payment-repository';
import healthRouter from './routes/health';
import { createPaymentRouter } from './routes/payments';
import { PaymentJobQueue } from './jobs/payment-job-queue';
import {
  SimulatedPaymentProcessor,
  type PaymentProcessor,
} from './jobs/processor';
import { PaymentService } from './services/payment-service';

export type AppDependencies = {
  paymentService?: PaymentService;
  jobQueue?: PaymentJobQueue;
  processor?: PaymentProcessor;
};

export type AppRuntime = {
  app: Express;
  paymentService: PaymentService;
  jobQueue: PaymentJobQueue;
};

export function createRuntime(deps: AppDependencies = {}): AppRuntime {
  const createdService = deps.paymentService === undefined;
  const paymentService =
    deps.paymentService ??
    new PaymentService(new FilePaymentRepository(config.dataFile));
  const processor =
    deps.processor ??
    new SimulatedPaymentProcessor({
      delayMs: config.processorDelayMs,
      failureRate: config.processorFailureRate,
    });
  const jobQueue =
    deps.jobQueue ??
    new PaymentJobQueue({
      paymentService,
      processor,
      concurrency: config.processorConcurrency,
      maxAttempts: config.processorMaxAttempts,
    });

  if (createdService || deps.jobQueue) {
    paymentService.attachJobQueue(jobQueue);
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  app.use('/health', healthRouter);
  app.use('/payments', createPaymentRouter(paymentService));

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
    });
  });

  app.use(errorHandler);

  return { app, paymentService, jobQueue };
}

export function createApp(deps: AppDependencies = {}): Express {
  return createRuntime(deps).app;
}
