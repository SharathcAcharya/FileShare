/**
 * Transfer Manager Hook
 * Orchestrates WebRTC, signaling, file streaming, and encryption
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCManager } from '../services/webrtc';
import { SignalingClient } from '../services/signaling';
import { FileStreamManager } from '../services/file-stream';
import { CryptoManager } from '../services/crypto';

export interface TransferSession {
  sessionId: string;
  token: string;
  peerId?: string;
  peerDisplayName?: string;
}

export interface TransferProgress {
  fileName: string;
  fileSize: number;
  transferred: number;
  percentage: number;
  speed: number;
  eta: number;
}

export interface TransferState {
  status: 'idle' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'error';
  signalingConnected: boolean;
  session?: TransferSession;
  progress?: TransferProgress;
  error?: string;
  fingerprint?: { hex: string; emoji: string };
}

export function useTransferManager() {
  const [state, setState] = useState<TransferState>({ 
    status: 'idle',
    signalingConnected: false 
  });
  
  // Initialize services (persistent across renders)
  const signaling = useRef<SignalingClient>();
  const webrtc = useRef<WebRTCManager>();
  const fileStream = useRef<FileStreamManager>();
  const crypto = useRef<CryptoManager>();
  const dataChannel = useRef<RTCDataChannel>();

  useEffect(() => {
    // Initialize services on mount
    signaling.current = new SignalingClient(
      import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:8080/ws'
    );
    
    webrtc.current = new WebRTCManager({
      iceServers: [
        { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
      ],
    });
    
    fileStream.current = new FileStreamManager();
    crypto.current = new CryptoManager();

    // Connect to signaling server
    console.log('[Hook] Connecting to signaling server...');
    setState((prev) => ({ ...prev, status: 'connecting' }));
    
    signaling.current.connect()
      .then(() => {
        console.log('[Hook] Connected to signaling server');
        setState((prev) => ({ 
          ...prev, 
          status: 'idle',
          signalingConnected: true 
        }));
      })
      .catch((error) => {
        console.error('[Hook] Failed to connect to signaling server:', error);
        setState((prev) => ({ 
          ...prev, 
          status: 'error', 
          signalingConnected: false,
          error: 'Failed to connect to server. Please check that the signaling server is running.' 
        }));
      });

    return () => {
      // Cleanup on unmount
      signaling.current?.disconnect();
      webrtc.current?.closeAll();
      crypto.current?.clearKeys();
    };
  }, []);

  /**
   * Create a new session (sender)
   */
  const createSession = useCallback(async (displayName: string = 'Device') => {
    try {
      // Check if signaling is connected (check directly from service)
      if (!signaling.current?.isConnected()) {
        throw new Error('Not connected to signaling server. Please wait for connection or refresh the page.');
      }

      setState((prev) => ({ ...prev, status: 'connecting' }));

      // Create session via signaling
      const sessionInfo = await signaling.current!.createSession(displayName);
      
      setState((prev) => ({
        ...prev,
        session: {
          sessionId: sessionInfo.sessionId,
          token: sessionInfo.token,
        },
      }));

      // Generate crypto keypair
      crypto.current!.generateKeyPair();
      console.log('[Hook] Keypair generated');

      // Set up peer connection
      const peerId = signaling.current!.getClientId();
      webrtc.current!.createPeerConnection(peerId, {
        onIceCandidate: (candidate) => {
          // Send ICE candidate to peer via signaling
          const otherPeerId = state.session?.peerId;
          if (otherPeerId) {
            signaling.current!.sendIceCandidate(otherPeerId, candidate);
          }
        },
        onConnectionStateChange: (connectionState) => {
          console.log('[Hook] Connection state:', connectionState);
          if (connectionState === 'connected') {
            setState((prev) => ({ ...prev, status: 'connected' }));
          } else if (connectionState === 'failed' || connectionState === 'closed') {
            setState((prev) => ({ ...prev, status: 'error', error: 'Connection failed' }));
          }
        },
      });

      // Create data channel
      const channel = webrtc.current!.createDataChannel(peerId, 'file-transfer');
      if (channel) {
        dataChannel.current = channel;
      }

      // Listen for peer joining
      signaling.current!.on('peer_joined', async (msg) => {
        console.log('[Hook] Peer joined:', msg.payload);
        
        setState((prev) => ({
          ...prev,
          session: {
            ...prev.session!,
            peerId: msg.payload.peerId,
            peerDisplayName: msg.payload.peerDisplayName,
          },
        }));

        // Create and send offer
        const offer = await webrtc.current!.createOffer(peerId);
        if (offer) {
          signaling.current!.sendOffer(msg.payload.peerId, offer.sdp!);
        }
      });

      // Listen for answer
      signaling.current!.on('answer', async (msg) => {
        console.log('[Hook] Received answer:', msg.payload);
        if (!msg.payload || !msg.payload.sdp || !msg.payload.type) {
          console.error('[Hook] Invalid answer payload:', msg.payload);
          return;
        }
        await webrtc.current!.setRemoteDescription(peerId, msg.payload);
      });

      // Listen for ICE candidates
      signaling.current!.on('ice_candidate', async (msg) => {
        console.log('[Hook] Received ICE candidate');
        await webrtc.current!.addIceCandidate(peerId, msg.payload);
      });

      return sessionInfo;
    } catch (error) {
      console.error('[Hook] Error creating session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
      setState((prev) => ({ ...prev, status: 'error', error: errorMessage }));
      throw error;
    }
  }, [state.session?.peerId]);

  /**
   * Join an existing session (receiver)
   */
  const joinSession = useCallback(async (
    sessionId: string,
    token: string,
    displayName: string = 'Device'
  ) => {
    try {
      // Check if signaling is connected (check directly from service)
      if (!signaling.current?.isConnected()) {
        throw new Error('Not connected to signaling server. Please wait for connection or refresh the page.');
      }

      setState((prev) => ({ ...prev, status: 'connecting' }));

      // Join session via signaling
      const peerInfo = await signaling.current!.joinSession(sessionId, token, displayName);
      
      setState((prev) => ({
        ...prev,
        session: {
          sessionId,
          token,
          peerId: peerInfo.peerId,
          peerDisplayName: peerInfo.displayName,
        },
      }));

      // Generate crypto keypair
      crypto.current!.generateKeyPair();
      console.log('[Hook] Keypair generated');

      // Set up peer connection
      const myId = signaling.current!.getClientId();
      webrtc.current!.createPeerConnection(myId, {
        onIceCandidate: (candidate) => {
          signaling.current!.sendIceCandidate(peerInfo.peerId, candidate);
        },
        onConnectionStateChange: (connectionState) => {
          console.log('[Hook] Connection state:', connectionState);
          if (connectionState === 'connected') {
            setState((prev) => ({ ...prev, status: 'connected' }));
          } else if (connectionState === 'failed' || connectionState === 'closed') {
            setState((prev) => ({ ...prev, status: 'error', error: 'Connection failed' }));
          }
        },
        onDataChannel: (channel) => {
          console.log('[Hook] Data channel received');
          dataChannel.current = channel;
        },
      });

      // Listen for offer
      signaling.current!.on('offer', async (msg) => {
        console.log('[Hook] Received offer:', msg.payload);
        if (!msg.payload || !msg.payload.sdp || !msg.payload.type) {
          console.error('[Hook] Invalid offer payload:', msg.payload);
          return;
        }
        await webrtc.current!.setRemoteDescription(myId, msg.payload);
        
        // Create and send answer
        const answer = await webrtc.current!.createAnswer(myId);
        if (answer) {
          signaling.current!.sendAnswer(peerInfo.peerId, answer.sdp!);
        }
      });

      // Listen for ICE candidates
      signaling.current!.on('ice_candidate', async (msg) => {
        console.log('[Hook] Received ICE candidate');
        await webrtc.current!.addIceCandidate(myId, msg.payload);
      });

      return peerInfo;
    } catch (error) {
      console.error('[Hook] Error joining session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join session';
      setState((prev) => ({ ...prev, status: 'error', error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Send file to peer
   */
  const sendFile = useCallback(async (file: File) => {
    try {
      if (!dataChannel.current || dataChannel.current.readyState !== 'open') {
        throw new Error('Data channel not ready');
      }

      setState((prev) => ({ ...prev, status: 'transferring' }));

      // Create file manifest
      const manifest = await fileStream.current!.createManifest(file);
      
      console.log('[Hook] Sending file:', manifest);

      // Track progress
      const startTime = Date.now();
      let lastUpdate = startTime;

      await fileStream.current!.sendFile({
        file,
        dataChannel: dataChannel.current,
        manifest,
        onProgress: (transferred, total) => {
          const now = Date.now();
          const elapsed = (now - startTime) / 1000; // seconds
          const speed = transferred / elapsed; // bytes per second
          const remaining = total - transferred;
          const eta = speed > 0 ? remaining / speed : 0;

          // Update progress every 100ms
          if (now - lastUpdate > 100) {
            setState((prev) => ({
              ...prev,
              progress: {
                fileName: file.name,
                fileSize: total,
                transferred,
                percentage: Math.round((transferred / total) * 100),
                speed,
                eta,
              },
            }));
            lastUpdate = now;
          }
        },
        onComplete: () => {
          console.log('[Hook] File sent successfully');
          setState((prev) => ({ ...prev, status: 'completed' }));
        },
      });
    } catch (error) {
      console.error('[Hook] Error sending file:', error);
      setState((prev) => ({ ...prev, status: 'error', error: 'Failed to send file' }));
      throw error;
    }
  }, []);

  /**
   * Receive file from peer
   */
  const receiveFile = useCallback(async () => {
    try {
      if (!dataChannel.current) {
        throw new Error('Data channel not ready');
      }

      setState((prev) => ({ ...prev, status: 'transferring' }));

      const startTime = Date.now();
      let lastUpdate = startTime;

      await fileStream.current!.receiveFile({
        dataChannel: dataChannel.current,
        onProgress: (transferred, total) => {
          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const speed = transferred / elapsed;
          const remaining = total - transferred;
          const eta = speed > 0 ? remaining / speed : 0;

          if (now - lastUpdate > 100) {
            setState((prev) => ({
              ...prev,
              progress: {
                fileName: prev.progress?.fileName || 'file',
                fileSize: total,
                transferred,
                percentage: Math.round((transferred / total) * 100),
                speed,
                eta,
              },
            }));
            lastUpdate = now;
          }
        },
        onComplete: (blob) => {
          console.log('[Hook] File received successfully');
          
          // Trigger download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = state.progress?.fileName || 'download';
          a.click();
          URL.revokeObjectURL(url);

          setState((prev) => ({ ...prev, status: 'completed' }));
        },
      });
    } catch (error) {
      console.error('[Hook] Error receiving file:', error);
      setState((prev) => ({ ...prev, status: 'error', error: 'Failed to receive file' }));
      throw error;
    }
  }, [state.progress?.fileName]);

  /**
   * Reset transfer state
   */
  const reset = useCallback(() => {
    setState((prev) => ({ 
      status: 'idle',
      signalingConnected: prev.signalingConnected 
    }));
    dataChannel.current = undefined;
  }, []);

  return {
    state,
    createSession,
    joinSession,
    sendFile,
    receiveFile,
    reset,
  };
}
