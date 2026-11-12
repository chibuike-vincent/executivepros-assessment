import pino from 'pino';
import { config } from './index';

const logger = pino({
  name: 'payment-service',
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
  ...(config.env === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    },
  }),
});

export default logger;
