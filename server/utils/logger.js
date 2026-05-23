const pino = require('pino');
const env = require('../config/env');

const isDev = env.nodeEnv !== 'production';

const base = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

// Drop-in replacement for the Winston interface used throughout the project.
// Normalises the common pattern: logger.error('msg:', errorObj)
const logger = {
  info:  (msg, meta) => meta !== undefined ? base.info(meta, msg)  : base.info(msg),
  warn:  (msg, meta) => meta !== undefined ? base.warn(meta, msg)  : base.warn(msg),
  debug: (msg, meta) => meta !== undefined ? base.debug(meta, msg) : base.debug(msg),
  error: (msg, meta) => {
    if (meta instanceof Error) base.error({ err: meta }, msg);
    else if (meta !== undefined) base.error(meta, msg);
    else base.error(msg);
  },
  // Expose raw pino instance for pino-http
  pino: base,
};

module.exports = logger;
