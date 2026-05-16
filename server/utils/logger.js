const winston = require('winston');
const env = require('../config/env');

const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, stack }) =>
            stack
              ? `${timestamp} [${level}]: ${message}\n${stack}`
              : `${timestamp} [${level}]: ${message}`
          )
        )
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
