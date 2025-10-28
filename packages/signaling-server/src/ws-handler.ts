/**
 * WebSocket Handler
 * Handles WebSocket connections and message routing
 */

import type { FastifyBaseLogger } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { IncomingMessage } from 'http';
import { SessionStore } from './session-store.js';

export interface SignalingMessage {
  type: string;
  sessionId?: string;
  from?: string;
  to?: string;
  timestamp: number;
  payload: any;
}

export class WebSocketHandler {
  private sessionStore: SessionStore;
  private logger: FastifyBaseLogger;
  private clientSessions: Map<any, { sessionId: string; clientId: string }> = new Map();

  constructor(sessionStore: SessionStore, logger: FastifyBaseLogger) {
    this.sessionStore = sessionStore;
    this.logger = logger;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(connection: SocketStream, request: IncomingMessage): void {
    const { socket } = connection;
    const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

    this.logger.info({ clientIp }, 'New WebSocket connection');

    socket.on('message', (data: Buffer) => {
      this.handleMessage(socket, data);
    });

    socket.on('close', () => {
      this.handleDisconnect(socket);
    });

    socket.on('error', (error) => {
      this.logger.error({ error }, 'WebSocket error');
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(socket: any, data: Buffer): void {
    try {
      const message: SignalingMessage = JSON.parse(data.toString());

      // Validate timestamp (prevent replay attacks)
      const now = Date.now();
      const timeDiff = Math.abs(now - message.timestamp);
      if (timeDiff > 300000) {
        // 5 minutes
        this.sendError(socket, 'INVALID_TIMESTAMP', 'Message timestamp too old');
        return;
      }

      this.logger.debug({ type: message.type }, 'Received message');

      // Route message based on type
      switch (message.type) {
        case 'create_session':
          this.handleCreateSession(socket, message);
          break;
        case 'join_session':
          this.handleJoinSession(socket, message);
          break;
        case 'offer':
        case 'answer':
        case 'ice_candidate':
          this.handleRelay(socket, message);
          break;
        case 'session_close':
          this.handleSessionClose(socket, message);
          break;
        default:
          this.sendError(socket, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error({ error }, 'Error parsing message');
      this.sendError(socket, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  /**
   * Handle create_session
   */
  private handleCreateSession(socket: any, message: SignalingMessage): void {
    const { clientId, displayName } = message.payload;

    if (!clientId || !displayName) {
      this.sendError(socket, 'INVALID_PAYLOAD', 'Missing clientId or displayName');
      return;
    }

    // Create new session
    const session = this.sessionStore.createSession();

    // Add creator as first client
    this.sessionStore.addClient(session.sessionId, clientId, displayName, socket);

    // Track client-session mapping
    this.clientSessions.set(socket, {
      sessionId: session.sessionId,
      clientId,
    });

    // Send response
    this.send(socket, {
      type: 'session_created',
      timestamp: Date.now(),
      payload: {
        sessionId: session.sessionId,
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });

    this.logger.info({ sessionId: session.sessionId }, 'Session created');
  }

  /**
   * Handle join_session
   */
  private handleJoinSession(socket: any, message: SignalingMessage): void {
    const { sessionId } = message;
    const { token, clientId, displayName } = message.payload;

    if (!sessionId || !token || !clientId || !displayName) {
      this.sendError(socket, 'INVALID_PAYLOAD', 'Missing required fields');
      return;
    }

    // Validate token
    if (!this.sessionStore.validateToken(sessionId, token)) {
      this.sendError(socket, 'INVALID_TOKEN', 'Session token is invalid or expired');
      return;
    }

    // Add client to session
    const added = this.sessionStore.addClient(sessionId, clientId, displayName, socket);
    if (!added) {
      this.sendError(socket, 'SESSION_FULL', 'Session already has maximum clients');
      return;
    }

    // Track client-session mapping
    this.clientSessions.set(socket, { sessionId, clientId });

    // Get other client (peer)
    const peer = this.sessionStore.getOtherClient(sessionId, clientId);

    // Send response to joiner
    this.send(socket, {
      type: 'session_joined',
      sessionId,
      timestamp: Date.now(),
      payload: {
        peerId: peer?.clientId,
        peerDisplayName: peer?.displayName,
      },
    });

    // Notify peer
    if (peer) {
      this.send(peer.socket, {
        type: 'peer_joined',
        sessionId,
        timestamp: Date.now(),
        payload: {
          peerId: clientId,
          peerDisplayName: displayName,
        },
      });
    }

    this.logger.info({ sessionId, clientId }, 'Client joined session');
  }

  /**
   * Handle relay messages (offer, answer, ice_candidate)
   */
  private handleRelay(socket: any, message: SignalingMessage): void {
    const { sessionId, from, to } = message;

    if (!sessionId || !from || !to) {
      this.sendError(socket, 'INVALID_PAYLOAD', 'Missing sessionId, from, or to');
      return;
    }

    // Verify sender is in session
    const session = this.sessionStore.getSession(sessionId);
    if (!session || !session.clients.has(from)) {
      this.sendError(socket, 'UNAUTHORIZED', 'Sender not in session');
      return;
    }

    // Get recipient
    const recipient = this.sessionStore.getClient(sessionId, to);
    if (!recipient) {
      this.sendError(socket, 'PEER_NOT_FOUND', 'Recipient not found in session');
      return;
    }

    // Forward message to recipient
    this.send(recipient.socket, message);

    this.logger.debug({ type: message.type, from, to }, 'Relayed message');
  }

  /**
   * Handle session_close
   */
  private handleSessionClose(socket: any, message: SignalingMessage): void {
    const mapping = this.clientSessions.get(socket);
    if (!mapping) {
      return;
    }

    const { sessionId, clientId } = mapping;

    // Notify other client
    const peer = this.sessionStore.getOtherClient(sessionId, clientId);
    if (peer) {
      this.send(peer.socket, {
        type: 'peer_left',
        sessionId,
        timestamp: Date.now(),
        payload: {
          peerId: clientId,
          reason: message.payload.reason || 'unknown',
        },
      });
    }

    // Remove client from session
    this.sessionStore.removeClient(sessionId, clientId);
    this.clientSessions.delete(socket);

    this.logger.info({ sessionId, clientId }, 'Client left session');
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: any): void {
    const mapping = this.clientSessions.get(socket);
    if (!mapping) {
      return;
    }

    const { sessionId, clientId } = mapping;

    // Notify other client
    const peer = this.sessionStore.getOtherClient(sessionId, clientId);
    if (peer) {
      this.send(peer.socket, {
        type: 'peer_disconnected',
        sessionId,
        timestamp: Date.now(),
        payload: {
          peerId: clientId,
        },
      });
    }

    // Remove client from session
    this.sessionStore.removeClient(sessionId, clientId);
    this.clientSessions.delete(socket);

    this.logger.info({ sessionId, clientId }, 'Client disconnected');
  }

  /**
   * Send message to client
   */
  private send(socket: any, message: SignalingMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error({ error }, 'Failed to send message');
    }
  }

  /**
   * Send error to client
   */
  private sendError(socket: any, code: string, message: string): void {
    this.send(socket, {
      type: 'error',
      timestamp: Date.now(),
      payload: {
        code,
        message,
      },
    });
  }
}
