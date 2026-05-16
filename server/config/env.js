require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
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
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  publicWebhookBaseUrl: process.env.PUBLIC_WEBHOOK_BASE_URL || 'https://midominio.com',
};
