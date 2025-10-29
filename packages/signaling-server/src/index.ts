/**
 * Signaling Server Entry Point
 * 
 * This server provides WebSocket-based signaling for WebRTC peer connections.
 * It handles session management, SDP exchange, and ICE candidate relay.
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
const isDevelopment = process.env.NODE_ENV !== 'production';

// Server startup function
async function startServer() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: isDevelopment
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
    // Increase timeouts for long-lived WebSocket connections
    keepAliveTimeout: 65000,
    connectionTimeout: 0, // Disable for WebSocket
  });

  // Error handlers for uncaught errors
  process.on('uncaughtException', (err) => {
    fastify.log.error({ err }, 'Uncaught Exception');
    if (!isDevelopment) {
      gracefulShutdown();
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    fastify.log.error({ reason, promise }, 'Unhandled Promise Rejection');
  });

  // Register plugins with error handling
  try {
    await fastify.register(fastifyHelmet, {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });

    await fastify.register(fastifyCors, {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    });

    await fastify.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      allowList: isDevelopment ? ['127.0.0.1', '::1'] : undefined,
    });

    await fastify.register(fastifyWebsocket, {
      options: {
        maxPayload: 1024 * 1024, // 1MB
        clientTracking: true,
        perMessageDeflate: false, // Disable compression for better compatibility
      },
    });

    fastify.log.info('All plugins registered successfully');
  } catch (err) {
    fastify.log.error({ err }, 'Failed to register plugins');
    throw err;
  }

  // Initialize stores
  const sessionStore = new SessionStore();
  const wsHandler = new WebSocketHandler(sessionStore, fastify.log);

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return {
      name: 'FileShare Signaling Server',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        websocket: 'ws://localhost:8080/ws',
        health: 'http://localhost:8080/health',
        stats: 'http://localhost:8080/stats',
      },
    };
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      connections: sessionStore.getActiveConnectionCount(),
      sessions: sessionStore.getActiveSessionCount(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  });

  // Stats endpoint (optional, add auth in production)
  fastify.get('/stats', async (request, reply) => {
    return {
      activeSessions: sessionStore.getActiveSessionCount(),
      activeConnections: sessionStore.getActiveConnectionCount(),
      totalSessionsCreated: sessionStore.getTotalSessionsCreated(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // WebSocket endpoint with error handling
  fastify.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      try {
        // Extract the raw IncomingMessage from FastifyRequest
        const request = req.raw;
        wsHandler.handleConnection(connection, request);
      } catch (err) {
        fastify.log.error({ err }, 'WebSocket connection error');
        connection.socket.close(1011, 'Internal server error');
      }
    });
  });

  // Graceful shutdown handler
  const gracefulShutdown = async () => {
    fastify.log.info('Received shutdown signal, closing gracefully...');
    
    try {
      // Close all WebSocket connections gracefully
      sessionStore.cleanup();
      
      // Close HTTP server
      await fastify.close();
      
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server with retry logic
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      await fastify.listen({ 
        port: PORT, 
        host: HOST,
        listenTextResolver: (address) => `Server listening at ${address}`
      });
      
      fastify.log.info(`✅ Signaling server started successfully!`);
      fastify.log.info(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
      fastify.log.info(`🏥 Health check: http://${HOST}:${PORT}/health`);
      fastify.log.info(`📊 Stats: http://${HOST}:${PORT}/stats`);
      
      // Server started successfully, break the retry loop
      break;
    } catch (err: any) {
      retries++;
      fastify.log.error({ err, retries }, `Failed to start server (attempt ${retries}/${maxRetries})`);
      
      if (err.code === 'EADDRINUSE') {
        fastify.log.error(`Port ${PORT} is already in use. Please free the port or change PORT environment variable.`);
      }
      
      if (retries >= maxRetries) {
        fastify.log.fatal('Max retries reached, exiting...');
        process.exit(1);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Start the server
console.log('🚀 Starting FileShare Signaling Server...');
console.log(`📍 Environment: ${isDevelopment ? 'development' : 'production'}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`🌐 Host: ${HOST}`);
console.log('');

startServer().catch((err) => {
  console.error('❌ Fatal error starting server:', err);
  process.exit(1);
});
