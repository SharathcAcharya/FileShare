/**
 * WebRTC Manager
 * Handles peer connections, ICE candidates, and DataChannel creation
 */

export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCConfig {
  iceServers: ICEServerConfig[];
}

export interface PeerConnectionCallbacks {
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
}

export class WebRTCManager {
  private config: WebRTCConfig;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  /**
   * Create a new peer connection
   */
  createPeerConnection(
    peerId: string,
    callbacks: PeerConnectionCallbacks = {}
  ): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      this.closePeerConnection(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // ICE candidate callback
    pc.onicecandidate = (event) => {
      if (event.candidate && callbacks.onIceCandidate) {
        callbacks.onIceCandidate(event.candidate);
      }
    };

    // Connection state change
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      if (callbacks.onConnectionStateChange) {
        callbacks.onConnectionStateChange(pc.connectionState);
      }

      // Clean up on failed/closed connections
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeerConnection(peerId);
      }
    };

    // ICE connection state change
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
      if (callbacks.onIceConnectionStateChange) {
        callbacks.onIceConnectionStateChange(pc.iceConnectionState);
      }
    };

    // Data channel callback (for receiving side)
    pc.ondatachannel = (event) => {
      console.log('[WebRTC] Data channel received:', event.channel.label);
      if (callbacks.onDataChannel) {
        callbacks.onDataChannel(event.channel);
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  /**
   * Create a data channel on existing peer connection
   */
  createDataChannel(
    peerId: string,
    label: string,
    options?: RTCDataChannelInit
  ): RTCDataChannel | null {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      console.error(`[WebRTC] Peer connection not found: ${peerId}`);
      return null;
    }

    const defaultOptions: RTCDataChannelInit = {
      ordered: true,
      maxRetransmits: 3,
      ...options,
    };

    const channel = pc.createDataChannel(label, defaultOptions);

    channel.onopen = () => {
      console.log(`[WebRTC] Data channel opened: ${label}`);
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel closed: ${label}`);
    };

    channel.onerror = (error) => {
      console.error(`[WebRTC] Data channel error on ${label}:`, error);
    };

    return channel;
  }

  /**
   * Create an offer (caller side)
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      console.error(`[WebRTC] Peer connection not found: ${peerId}`);
      return null;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      return null;
    }
  }

  /**
   * Create an answer (callee side)
   */
  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      console.error(`[WebRTC] Peer connection not found: ${peerId}`);
      return null;
    }

    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('[WebRTC] Error creating answer:', error);
      return null;
    }
  }

  /**
   * Set remote description (offer or answer)
   */
  async setRemoteDescription(
    peerId: string,
    description: RTCSessionDescriptionInit
  ): Promise<boolean> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      console.error(`[WebRTC] Peer connection not found: ${peerId}`);
      return false;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(description));
      return true;
    } catch (error) {
      console.error('[WebRTC] Error setting remote description:', error);
      return false;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<boolean> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      console.error(`[WebRTC] Peer connection not found: ${peerId}`);
      return false;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  async getStats(peerId: string): Promise<RTCStatsReport | null> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) {
      return null;
    }

    try {
      return await pc.getStats();
    } catch (error) {
      console.error('[WebRTC] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Check if using TURN relay
   */
  async isUsingTurn(peerId: string): Promise<boolean> {
    const stats = await this.getStats(peerId);
    if (!stats) return false;

    for (const [, stat] of stats) {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        const localCandidate = stats.get(stat.localCandidateId);
        if (localCandidate && localCandidate.candidateType === 'relay') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Close peer connection
   */
  closePeerConnection(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
      console.log(`[WebRTC] Peer connection closed: ${peerId}`);
    }
  }

  /**
   * Close all peer connections
   */
  closeAll(): void {
    for (const [peerId] of this.peerConnections) {
      this.closePeerConnection(peerId);
    }
  }

  /**
   * Get peer connection
   */
  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(peerId);
  }
}
