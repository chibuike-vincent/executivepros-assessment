import express, { type Express, type Request, type Response } from 'express';
import pinoHttp from 'pino-http';
import { config } from './config';
import logger from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { FilePaymentRepository } from './repositories/payment-repository';
import healthRouter from './routes/health';
import { createPaymentRouter } from './routes/payments';
import { PaymentService } from './services/payment-service';

export type AppDependencies = {
  paymentService?: PaymentService;
};

export function createApp(deps: AppDependencies = {}): Express {
  const paymentService =
    deps.paymentService ??
    new PaymentService(new FilePaymentRepository(config.dataFile));

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

  return app;
}
