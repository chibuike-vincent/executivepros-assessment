import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response,
} from 'express';
import pinoHttp from 'pino-http';
import logger from './config/logger';
import healthRouter from './routes/health';

export function createApp(): Express {
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

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
    });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    req.log?.error({ err }, 'Unhandled application error');

    if (res.headersSent) {
      next(err);
      return;
    }

    const isSyntaxError = err instanceof SyntaxError && 'body' in err;
    if (isSyntaxError) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  };

  app.use(errorHandler);

  return app;
}
