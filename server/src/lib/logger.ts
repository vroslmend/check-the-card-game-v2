import { pino } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// In development, use pino-pretty for human-readable logs.
// In production, output standard JSON for ingestion by log services.
const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: !isProduction ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger; 