/**
 * Signaling Server Entry Point
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { WebSocketHandler } from './ws-handler.js';
import { SessionStore } from './session-store.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

// Register plugins
await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: false,
});

await fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});

await fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await fastify.register(fastifyWebsocket, {
  options: {
    maxPayload: 1024 * 1024, // 1MB
    clientTracking: true,
  },
});

// Initialize stores
const sessionStore = new SessionStore();
const wsHandler = new WebSocketHandler(sessionStore, fastify.log);

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    connections: sessionStore.getActiveConnectionCount(),
    sessions: sessionStore.getActiveSessionCount(),
  };
});

// Stats endpoint (optional, add auth in production)
fastify.get('/stats', async (request, reply) => {
  return {
    activeSessions: sessionStore.getActiveSessionCount(),
    activeConnections: sessionStore.getActiveConnectionCount(),
    totalSessionsCreated: sessionStore.getTotalSessionsCreated(),
  };
});

// WebSocket endpoint
fastify.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    wsHandler.handleConnection(connection, request);
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await fastify.close();
  sessionStore.cleanup();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`Signaling server listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
