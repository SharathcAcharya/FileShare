/**
 * File Stream Manager
 * Handles file chunking, streaming, backpressure, and resume logic
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Constants
const CHUNK_SIZE = 65536; // 64 KB
const BUFFER_THRESHOLD = 16 * 1024 * 1024; // 16 MB
const MAX_RETRIES = 3;

// Types
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
}

export interface ProgressCallback {
  (sent: number, total: number): void;
}

export interface CompleteCallback {
  (): void;
}

// IndexedDB Schema
interface TransferDB extends DBSchema {
  transfers: {
    key: string;
    value: TransferState;
    indexes: { 'by-peer': string };
  };
  chunks: {
    key: string; // fileId-chunkIndex
    value: {
      fileId: string;
      chunkIndex: number;
      data: Uint8Array;
    };
  };
}

export class FileStreamManager {
  private db: IDBPDatabase<TransferDB> | null = null;
  private chunkSize: number;
  private bufferThreshold: number;

  constructor(
    chunkSize: number = CHUNK_SIZE,
    bufferThreshold: number = BUFFER_THRESHOLD
  ) {
    this.chunkSize = chunkSize;
    this.bufferThreshold = bufferThreshold;
    this.initDB();
  }

  private async initDB() {
    this.db = await openDB<TransferDB>('fileshare-transfers', 1, {
      upgrade(db) {
        const transferStore = db.createObjectStore('transfers', {
          keyPath: 'fileId',
        });
        transferStore.createIndex('by-peer', 'peerId');

        db.createObjectStore('chunks', {
          keyPath: ['fileId', 'chunkIndex'],
        });
      },
    });
  }

  /**
   * Create file manifest from File object
   */
  async createManifest(file: File): Promise<FileManifest> {
    const fileId = this.generateFileId();
    const chunkCount = Math.ceil(file.size / this.chunkSize);
    const checksum = await this.computeChecksum(file);

    return {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      chunkSize: this.chunkSize,
      chunkCount,
      checksum,
    };
  }

  /**
   * Send file over data channel
   */
  async sendFile(options: {
    file: File;
    dataChannel: RTCDataChannel;
    manifest: FileManifest;
    onProgress?: ProgressCallback;
    onComplete?: CompleteCallback;
  }): Promise<void> {
    const { file, dataChannel, manifest, onProgress, onComplete } = options;

    // Wait for channel to be open
    if (dataChannel.readyState !== 'open') {
      await new Promise<void>((resolve, reject) => {
        dataChannel.onopen = () => resolve();
        dataChannel.onerror = () => reject(new Error('Data channel failed'));
        setTimeout(() => reject(new Error('Data channel open timeout')), 30000);
      });
    }

    // Send manifest first
    this.sendJSON(dataChannel, {
      type: 'file_manifest',
      ...manifest,
    });

    // Wait for manifest acknowledgment
    await this.waitForMessage(dataChannel, 'manifest_ack');

    // Stream chunks
    let sentBytes = 0;
    const totalBytes = file.size;

    for (let chunkIndex = 0; chunkIndex < manifest.chunkCount; chunkIndex++) {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const chunk = await this.readChunk(file, start, end);

      // Send chunk with header
      await this.sendChunk(dataChannel, manifest.fileId, chunkIndex, chunk);

      // Wait for acknowledgment
      await this.waitForMessage(dataChannel, 'chunk_ack', (msg) => {
        return msg.fileId === manifest.fileId && msg.chunkIndex === chunkIndex;
      });

      sentBytes += chunk.byteLength;

      if (onProgress) {
        onProgress(sentBytes, totalBytes);
      }

      // Backpressure control
      await this.waitForBufferDrain(dataChannel);
    }

    if (onComplete) {
      onComplete();
    }

    console.log(`[FileStream] File sent: ${manifest.fileName}`);
  }

  /**
   * Receive file over data channel
   */
  async receiveFile(options: {
    dataChannel: RTCDataChannel;
    onProgress?: ProgressCallback;
    onComplete?: (blob: Blob) => void;
  }): Promise<void> {
    const { dataChannel, onProgress, onComplete } = options;

    // Wait for manifest
    const manifestMsg = await this.waitForMessage<FileManifest>(
      dataChannel,
      'file_manifest'
    );

    const manifest = manifestMsg as FileManifest;
    console.log(`[FileStream] Receiving file: ${manifest.fileName}`);

    // Send manifest acknowledgment
    this.sendJSON(dataChannel, {
      type: 'manifest_ack',
      fileId: manifest.fileId,
      accepted: true,
    });

    // Prepare to receive chunks
    const chunks = new Map<number, Uint8Array>();
    let receivedBytes = 0;
    const totalBytes = manifest.fileSize;

    // Set up chunk receiver
    const receivePromise = new Promise<void>((resolve, reject) => {
      dataChannel.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          // JSON message - ignore for now
          return;
        }

        // Binary chunk
        const arrayBuffer = event.data as ArrayBuffer;
        const { header, payload } = this.parseChunk(arrayBuffer);

        if (header.fileId !== manifest.fileId) {
          return;
        }

        // Store chunk
        chunks.set(header.chunkIndex, payload);
        receivedBytes += payload.byteLength;

        // Send acknowledgment
        this.sendJSON(dataChannel, {
          type: 'chunk_ack',
          fileId: header.fileId,
          chunkIndex: header.chunkIndex,
        });

        if (onProgress) {
          onProgress(receivedBytes, totalBytes);
        }

        // Check if complete
        if (chunks.size === manifest.chunkCount) {
          resolve();
        }
      };

      dataChannel.onerror = (error) => {
        reject(error);
      };

      setTimeout(() => reject(new Error('Receive timeout')), 300000); // 5 min
    });

    await receivePromise;

    // Reassemble file
    const blob = await this.reassembleFile(chunks, manifest);

    // Verify checksum
    const receivedChecksum = await this.computeChecksumFromBlob(blob);
    if (receivedChecksum !== manifest.checksum) {
      throw new Error('Checksum mismatch - file corrupted');
    }

    console.log(`[FileStream] File received: ${manifest.fileName}`);

    if (onComplete) {
      onComplete(blob);
    }
  }

  /**
   * Send chunk with header
   */
  private async sendChunk(
    channel: RTCDataChannel,
    fileId: string,
    chunkIndex: number,
    chunk: Uint8Array
  ): Promise<void> {
    const header = this.encodeHeader({
      fileId,
      chunkIndex,
      chunkSize: chunk.byteLength,
    });

    const message = new Uint8Array(header.byteLength + chunk.byteLength);
    message.set(new Uint8Array(header), 0);
    message.set(chunk, header.byteLength);

    channel.send(message);
  }

  /**
   * Parse chunk from binary data
   */
  private parseChunk(data: ArrayBuffer): {
    header: ChunkHeader;
    payload: Uint8Array;
  } {
    const headerSize = 24; // 16 (fileId) + 4 (chunkIndex) + 4 (chunkSize)
    const headerView = new DataView(data, 0, headerSize);

    // Parse UUID from bytes
    const fileIdBytes = new Uint8Array(data, 0, 16);
    const fileId = this.bytesToUuid(fileIdBytes);

    const chunkIndex = headerView.getUint32(16, true); // little-endian
    const chunkSize = headerView.getUint32(20, true);

    const payload = new Uint8Array(data, headerSize, chunkSize);

    return {
      header: { fileId, chunkIndex, chunkSize },
      payload,
    };
  }

  /**
   * Encode chunk header
   */
  private encodeHeader(header: ChunkHeader): ArrayBuffer {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);

    // UUID to bytes
    const uuidBytes = this.uuidToBytes(header.fileId);
    new Uint8Array(buffer, 0, 16).set(uuidBytes);

    // Chunk index and size
    view.setUint32(16, header.chunkIndex, true);
    view.setUint32(20, header.chunkSize, true);

    return buffer;
  }

  /**
   * Wait for data channel buffer to drain
   */
  private async waitForBufferDrain(channel: RTCDataChannel): Promise<void> {
    if (channel.bufferedAmount < this.bufferThreshold) {
      return;
    }

    return new Promise<void>((resolve) => {
      const checkBuffer = () => {
        if (channel.bufferedAmount < this.bufferThreshold) {
          resolve();
        } else {
          setTimeout(checkBuffer, 100);
        }
      };
      checkBuffer();
    });
  }

  /**
   * Wait for specific message type
   */
  private waitForMessage<T = any>(
    channel: RTCDataChannel,
    type: string,
    validator?: (msg: any) => boolean
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const originalOnMessage = channel.onmessage;

      channel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === type) {
              if (!validator || validator(msg)) {
                channel.onmessage = originalOnMessage;
                resolve(msg as T);
                return;
              }
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }

        // Pass through to original handler
        if (originalOnMessage) {
          originalOnMessage(event);
        }
      };

      setTimeout(() => {
        channel.onmessage = originalOnMessage;
        reject(new Error(`Timeout waiting for ${type}`));
      }, 30000);
    });
  }

  /**
   * Send JSON message
   */
  private sendJSON(channel: RTCDataChannel, data: any): void {
    channel.send(JSON.stringify(data));
  }

  /**
   * Read chunk from file
   */
  private readChunk(file: File, start: number, end: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(start, end));
    });
  }

  /**
   * Reassemble file from chunks
   */
  private async reassembleFile(
    chunks: Map<number, Uint8Array>,
    manifest: FileManifest
  ): Promise<Blob> {
    const sortedChunks: Uint8Array[] = [];
    for (let i = 0; i < manifest.chunkCount; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      sortedChunks.push(chunk);
    }

    return new Blob(sortedChunks, { type: manifest.mimeType });
  }

  /**
   * Compute SHA-256 checksum
   */
  private async computeChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }

  /**
   * Compute checksum from Blob
   */
  private async computeChecksumFromBlob(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return crypto.randomUUID();
  }

  /**
   * UUID to bytes
   */
  private uuidToBytes(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Bytes to UUID
   */
  private bytesToUuid(bytes: Uint8Array): string {
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(
      16,
      4
    )}-${hex.substr(20, 12)}`;
  }

  /**
   * Save transfer state
   */
  async saveTransferState(state: TransferState): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.put('transfers', state);
  }

  /**
   * Load transfer state
   */
  async loadTransferState(fileId: string): Promise<TransferState | undefined> {
    if (!this.db) await this.initDB();
    return await this.db!.get('transfers', fileId);
  }

  /**
   * Delete transfer state
   */
  async deleteTransferState(fileId: string): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.delete('transfers', fileId);
  }
}
