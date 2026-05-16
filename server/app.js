const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { errorMiddleware, notFoundMiddleware } = require('./middlewares/errorMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const movementsRoutes = require('./routes/movementsRoutes');
const accountsRoutes = require('./routes/accountsRoutes');
const domainsRoutes = require('./routes/domainsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const deliveriesRoutes = require('./routes/deliveriesRoutes');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-token', 'x-HG-Webhook-Signature'],
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});

app.use('/api/', apiLimiter);

app.use(cookieParser());
// Capture raw body globally so webhook routes can verify HMAC signatures
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/deliveries', deliveriesRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 and error handlers
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
