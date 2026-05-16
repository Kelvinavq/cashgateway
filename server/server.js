const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/database');
const { connectRedis } = require('./config/redis');
const socketService = require('./services/socketService');
const logger = require('./utils/logger');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

socketService.init(io);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
});

async function start() {
  await testConnection();
  await connectRedis();

  server.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
    logger.info(`Frontend: ${env.frontendUrl}`);
  });
}

start().catch((err) => {
  logger.error('Startup error:', err);
  process.exit(1);
});
