/**
 * Shared Types
 * Common types used across packages
 */

export interface FileManifest {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  chunkCount: number;
  checksum: string;
}

export interface ChunkHeader {
  fileId: string;
  chunkIndex: number;
  chunkSize: number;
}

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

export interface TransferProgress {
  fileId: string;
  fileName: string;
  transferred: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
}

export interface TransferState {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  checksum: string;
  peerId: string;
  timestamp: number;
  direction: 'send' | 'receive';
  status: 'pending' | 'transferring' | 'completed' | 'failed';
}

export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCConfig {
  iceServers: ICEServerConfig[];
}

export type ErrorCode =
  | 'INVALID_TOKEN'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_FULL'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_MESSAGE'
  | 'PEER_DISCONNECTED'
  | 'TRANSFER_FAILED'
  | 'CHECKSUM_MISMATCH'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT';

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  details?: any;
}
