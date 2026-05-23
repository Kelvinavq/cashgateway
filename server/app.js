const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');
const requestId = require('./middlewares/requestId');
const { errorMiddleware, notFoundMiddleware } = require('./middlewares/errorMiddleware');

// Routes
const authRoutes       = require('./routes/authRoutes');
const webhookRoutes    = require('./routes/webhookRoutes');
const movementsRoutes  = require('./routes/movementsRoutes');
const accountsRoutes   = require('./routes/accountsRoutes');
const domainsRoutes    = require('./routes/domainsRoutes');
const dashboardRoutes  = require('./routes/dashboardRoutes');
const deliveriesRoutes = require('./routes/deliveriesRoutes');
const providersRoutes  = require('./routes/providersRoutes');
const logsRoutes       = require('./routes/logsRoutes');

const app = express();
const isAllowedOrigin = (origin) => !origin || env.allowedOrigins.includes(origin);

// Request ID (must be first)
app.use(requestId);

// Structured HTTP logging via pino-http
app.use(pinoHttp({
  logger: logger.pino,
  genReqId: (req) => req.requestId,
  customLogLevel: (_req, res) => res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
}));

// Security
app.use(helmet());
app.set('trust proxy', 1); // Trust first proxy for correct req.ip
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-token', 'x-HG-Webhook-Signature'],
}));

// Global rate limiting (coarse)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

app.use(cookieParser());
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth',       authRoutes);
app.use('/api/webhooks',   webhookRoutes);
app.use('/api/movements',  movementsRoutes);
app.use('/api/accounts',   accountsRoutes);
app.use('/api/domains',    domainsRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/providers',  providersRoutes);
app.use('/api/logs',       logsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
