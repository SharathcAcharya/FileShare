/**
 * Signaling Client
 * WebSocket client for signaling server communication
 */

export interface SignalingMessage {
  type: string;
  sessionId?: string;
  from?: string;
  to?: string;
  timestamp: number;
  payload: any;
}

export interface SessionInfo {
  sessionId: string;
  token: string;
  expiresAt: number;
}

export interface PeerInfo {
  peerId: string;
  displayName: string;
}

export type MessageHandler = (message: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private clientId: string;
  private sessionId?: string;
  private connected = false;

  constructor(url: string) {
    this.url = url;
    this.clientId = crypto.randomUUID();
  }

  /**
   * Connect to signaling server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[Signaling] Connected to server');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          console.log('[Signaling] Disconnected from server');
          this.connected = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[Signaling] WebSocket error:', error);
          reject(error);
        };

        // Timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from signaling server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Signaling] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[Signaling] Reconnect failed:', error);
      }
    }, delay);
  }

  /**
   * Create a new session
   */
  async createSession(displayName: string): Promise<SessionInfo> {
    if (!this.connected) {
      throw new Error('Not connected to signaling server');
    }

    return new Promise((resolve, reject) => {
      const handler = (msg: SignalingMessage) => {
        if (msg.type === 'session_created') {
          this.sessionId = msg.payload.sessionId;
          this.off('session_created', handler);
          resolve(msg.payload as SessionInfo);
        } else if (msg.type === 'error') {
          this.off('session_created', handler);
          reject(new Error(msg.payload.message));
        }
      };

      this.on('session_created', handler);
      this.on('error', handler);

      this.send({
        type: 'create_session',
        timestamp: Date.now(),
        payload: {
          clientId: this.clientId,
          displayName,
        },
      });

      // Timeout
      setTimeout(() => {
        this.off('session_created', handler);
        this.off('error', handler);
        reject(new Error('Create session timeout'));
      }, 10000);
    });
  }

  /**
   * Join an existing session
   */
  async joinSession(
    sessionId: string,
    token: string,
    displayName: string
  ): Promise<PeerInfo> {
    if (!this.connected) {
      throw new Error('Not connected to signaling server');
    }

    return new Promise((resolve, reject) => {
      const handler = (msg: SignalingMessage) => {
        if (msg.type === 'session_joined') {
          this.sessionId = sessionId;
          this.off('session_joined', handler);
          resolve(msg.payload as PeerInfo);
        } else if (msg.type === 'error') {
          this.off('session_joined', handler);
          reject(new Error(msg.payload.message));
        }
      };

      this.on('session_joined', handler);
      this.on('error', handler);

      this.send({
        type: 'join_session',
        sessionId,
        timestamp: Date.now(),
        payload: {
          token,
          clientId: this.clientId,
          displayName,
        },
      });

      // Timeout
      setTimeout(() => {
        this.off('session_joined', handler);
        this.off('error', handler);
        reject(new Error('Join session timeout'));
      }, 10000);
    });
  }

  /**
   * Send offer
   */
  sendOffer(peerId: string, sdp: string): void {
    this.send({
      type: 'offer',
      sessionId: this.sessionId,
      from: this.clientId,
      to: peerId,
      timestamp: Date.now(),
      payload: { 
        type: 'offer',
        sdp 
      },
    });
  }

  /**
   * Send answer
   */
  sendAnswer(peerId: string, sdp: string): void {
    this.send({
      type: 'answer',
      sessionId: this.sessionId,
      from: this.clientId,
      to: peerId,
      timestamp: Date.now(),
      payload: { 
        type: 'answer',
        sdp 
      },
    });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    this.send({
      type: 'ice_candidate',
      sessionId: this.sessionId,
      from: this.clientId,
      to: peerId,
      timestamp: Date.now(),
      payload: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      },
    });
  }

  /**
   * Close session
   */
  closeSession(reason: string = 'user_closed'): void {
    this.send({
      type: 'session_close',
      sessionId: this.sessionId,
      from: this.clientId,
      timestamp: Date.now(),
      payload: { reason },
    });
    this.sessionId = undefined;
  }

  /**
   * Send message to server
   */
  private send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[Signaling] Cannot send message: not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: SignalingMessage = JSON.parse(data);
      console.log(`[Signaling] Received: ${message.type}`);

      // Validate timestamp (prevent replay attacks)
      const now = Date.now();
      const timeDiff = Math.abs(now - message.timestamp);
      if (timeDiff > 300000) {
        // 5 minutes
        console.warn('[Signaling] Message timestamp too old, ignoring');
        return;
      }

      // Emit to handlers
      this.emit(message.type, message);
    } catch (error) {
      console.error('[Signaling] Error parsing message:', error);
    }
  }

  /**
   * Register event handler
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(type: string, message: SignalingMessage): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
