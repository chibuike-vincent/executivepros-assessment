import { createApp } from './app';
import { config } from './config';
import logger from './config/logger';

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  logger.info(
    { host: config.host, port: config.port, env: config.env },
    'Payment service listening',
  );
});

server.on('error', (err) => {
  logger.fatal({ err }, 'Failed to start HTTP server');
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error while closing HTTP server');
      process.exit(1);
    }

    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
