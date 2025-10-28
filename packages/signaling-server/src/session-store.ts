/**
 * Session Store
 * Manages active sessions and client connections
 */

import { randomUUID, randomBytes } from 'crypto';

export interface Session {
  sessionId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  clients: Map<string, ClientConnection>;
}

export interface ClientConnection {
  clientId: string;
  displayName: string;
  socket: any; // WebSocket
  joinedAt: number;
}

export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private totalSessionsCreated = 0;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  createSession(): Session {
    const sessionId = this.generateId();
    const token = this.generateToken();
    const now = Date.now();

    const session: Session = {
      sessionId,
      token,
      createdAt: now,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
      clients: new Map(),
    };

    this.sessions.set(sessionId, session);
    this.totalSessionsCreated++;

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);

    // Check expiry
    if (session && Date.now() > session.expiresAt) {
      this.deleteSession(sessionId);
      return undefined;
    }

    return session;
  }

  /**
   * Validate session token
   */
  validateToken(sessionId: string, token: string): boolean {
    const session = this.getSession(sessionId);
    return session ? session.token === token : false;
  }

  /**
   * Add client to session
   */
  addClient(
    sessionId: string,
    clientId: string,
    displayName: string,
    socket: any
  ): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Limit to 2 clients per session (P2P)
    if (session.clients.size >= 2) {
      return false;
    }

    const client: ClientConnection = {
      clientId,
      displayName,
      socket,
      joinedAt: Date.now(),
    };

    session.clients.set(clientId, client);
    return true;
  }

  /**
   * Remove client from session
   */
  removeClient(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.clients.delete(clientId);

      // Delete session if no clients left
      if (session.clients.size === 0) {
        this.deleteSession(sessionId);
      }
    }
  }

  /**
   * Get client from session
   */
  getClient(sessionId: string, clientId: string): ClientConnection | undefined {
    const session = this.getSession(sessionId);
    return session?.clients.get(clientId);
  }

  /**
   * Get other client in session (for P2P)
   */
  getOtherClient(sessionId: string, clientId: string): ClientConnection | undefined {
    const session = this.getSession(sessionId);
    if (!session) return undefined;

    for (const [id, client] of session.clients) {
      if (id !== clientId) {
        return client;
      }
    }

    return undefined;
  }

  /**
   * Get all clients in session
   */
  getClients(sessionId: string): ClientConnection[] {
    const session = this.getSession(sessionId);
    return session ? Array.from(session.clients.values()) : [];
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Close all client connections
      for (const client of session.clients.values()) {
        try {
          client.socket.close();
        } catch (e) {
          // Ignore errors
        }
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.deleteSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionStore] Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.clients.size;
    }
    return count;
  }

  /**
   * Get total sessions created
   */
  getTotalSessionsCreated(): number {
    return this.totalSessionsCreated;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    clearInterval(this.cleanupInterval);
    for (const sessionId of this.sessions.keys()) {
      this.deleteSession(sessionId);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return randomUUID();
  }

  /**
   * Generate secure token (256 bits)
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64');
  }
}
