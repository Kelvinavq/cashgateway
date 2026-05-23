require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const frontendUrl = process.env.FRONTEND_URL || (isProduction ? 'https://admin.flowhg.online' : 'http://localhost:5173');
const productionOrigins = isProduction
  ? ['https://admin.flowhg.online']
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

const allowedOrigins = Array.from(new Set([
  frontendUrl,
  ...productionOrigins,
].filter(Boolean)));

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv,
  frontendUrl,
  allowedOrigins,
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'hgcash_gateway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  cookie: {
    name: process.env.COOKIE_NAME || 'hgcash_gateway_token',
    domain: isProduction ? (process.env.COOKIE_DOMAIN || undefined) : undefined,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  publicWebhookBaseUrl: process.env.PUBLIC_WEBHOOK_BASE_URL || (isProduction ? 'https://flowhg.online' : 'http://localhost:3000'),
};
