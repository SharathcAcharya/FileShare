# API Reference

## Signaling Protocol

WebSocket-based signaling protocol for peer discovery and WebRTC negotiation.

### Connection

**Endpoint:** `wss://signal.fileshare.app/ws`

**Authentication:** Session token (after session creation)

### Message Format

All messages are JSON:

```typescript
interface SignalingMessage {
  type: string;           // Message type
  sessionId?: string;     // Session identifier
  from?: string;          // Sender client ID
  to?: string;            // Recipient client ID
  timestamp: number;      // Unix timestamp (ms)
  payload: any;           // Message-specific data
}
```

### Message Types

#### 1. create_session

Creates a new transfer session.

**Request:**
```json
{
  "type": "create_session",
  "timestamp": 1234567890,
  "payload": {
    "clientId": "uuid-v4",
    "displayName": "Alice's iPhone"
  }
}
```

**Response:**
```json
{
  "type": "session_created",
  "timestamp": 1234567890,
  "payload": {
    "sessionId": "uuid-v4",
    "token": "base64-256bit-token",
    "expiresAt": 1234571490
  }
}
```

#### 2. join_session

Joins an existing session.

**Request:**
```json
{
  "type": "join_session",
  "sessionId": "uuid-v4",
  "timestamp": 1234567890,
  "payload": {
    "token": "base64-256bit-token",
    "clientId": "uuid-v4",
    "displayName": "Bob's Laptop"
  }
}
```

**Response:**
```json
{
  "type": "session_joined",
  "sessionId": "uuid-v4",
  "timestamp": 1234567890,
  "payload": {
    "peerId": "uuid-v4",
    "peerDisplayName": "Alice's iPhone"
  }
}
```

#### 3. offer

WebRTC SDP offer.

**Request:**
```json
{
  "type": "offer",
  "sessionId": "uuid-v4",
  "from": "client-a-id",
  "to": "client-b-id",
  "timestamp": 1234567890,
  "payload": {
    "sdp": "v=0\r\no=- ..."
  }
}
```

#### 4. answer

WebRTC SDP answer.

**Request:**
```json
{
  "type": "answer",
  "sessionId": "uuid-v4",
  "from": "client-b-id",
  "to": "client-a-id",
  "timestamp": 1234567890,
  "payload": {
    "sdp": "v=0\r\no=- ..."
  }
}
```

#### 5. ice_candidate

ICE candidate for NAT traversal.

**Request:**
```json
{
  "type": "ice_candidate",
  "sessionId": "uuid-v4",
  "from": "client-a-id",
  "to": "client-b-id",
  "timestamp": 1234567890,
  "payload": {
    "candidate": "candidate:... udp ...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

#### 6. session_close

Closes a session.

**Request:**
```json
{
  "type": "session_close",
  "sessionId": "uuid-v4",
  "from": "client-a-id",
  "timestamp": 1234567890,
  "payload": {
    "reason": "transfer_complete"
  }
}
```

#### 7. error

Error response.

**Response:**
```json
{
  "type": "error",
  "sessionId": "uuid-v4",
  "timestamp": 1234567890,
  "payload": {
    "code": "INVALID_TOKEN",
    "message": "Session token is invalid or expired"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Session token invalid or expired |
| `SESSION_NOT_FOUND` | Session ID does not exist |
| `SESSION_FULL` | Session already has 2 participants |
| `RATE_LIMIT_EXCEEDED` | Too many requests from this IP |
| `INVALID_MESSAGE` | Malformed message |
| `PEER_DISCONNECTED` | Other peer left session |

---

## File Transfer Protocol

Binary protocol over WebRTC DataChannel.

### Message Types

#### 1. file_manifest

Sent before transfer begins (encrypted over DataChannel).

```typescript
interface FileManifest {
  type: 'file_manifest';
  fileId: string;          // UUID v4
  fileName: string;        // Original filename
  fileSize: number;        // Total bytes
  mimeType: string;        // MIME type
  chunkSize: number;       // Bytes per chunk (typically 65536)
  chunkCount: number;      // Total chunks
  checksum: string;        // SHA-256 of entire file
}
```

**JSON Example:**
```json
{
  "type": "file_manifest",
  "fileId": "f_abc123",
  "fileName": "vacation.mp4",
  "fileSize": 1073741824,
  "mimeType": "video/mp4",
  "chunkSize": 65536,
  "chunkCount": 16384,
  "checksum": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

#### 2. manifest_ack

Receiver acknowledges manifest.

```typescript
interface ManifestAck {
  type: 'manifest_ack';
  fileId: string;
  accepted: boolean;
  reason?: string;         // If rejected
}
```

#### 3. chunk (Binary)

Binary chunk format:

```
[Header: 24 bytes] [Payload: up to 65536 bytes]

Header:
  - fileId: 16 bytes (UUID binary)
  - chunkIndex: 4 bytes (uint32, little-endian)
  - chunkSize: 4 bytes (uint32, little-endian)

Payload:
  - Encrypted chunk data
  - Poly1305 tag (16 bytes) at end
```

**JavaScript Encoding:**
```typescript
function encodeChunk(
  fileId: string,
  chunkIndex: number,
  encryptedData: Uint8Array
): Uint8Array {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);
  
  // UUID to binary
  const uuidBytes = uuidToBytes(fileId);
  new Uint8Array(header, 0, 16).set(uuidBytes);
  
  // Chunk index
  view.setUint32(16, chunkIndex, true);  // little-endian
  
  // Chunk size
  view.setUint32(20, encryptedData.length, true);
  
  // Concatenate header + payload
  const result = new Uint8Array(24 + encryptedData.length);
  result.set(new Uint8Array(header), 0);
  result.set(encryptedData, 24);
  
  return result;
}
```

#### 4. chunk_ack

Receiver acknowledges chunk receipt.

```typescript
interface ChunkAck {
  type: 'chunk_ack';
  fileId: string;
  chunkIndex: number;
  checksum?: string;       // Optional: SHA-256 of chunk
}
```

**JSON Example:**
```json
{
  "type": "chunk_ack",
  "fileId": "f_abc123",
  "chunkIndex": 42
}
```

#### 5. resume_request

Request to resume interrupted transfer.

```typescript
interface ResumeRequest {
  type: 'resume_request';
  fileId: string;
  receivedChunks: number[];  // Array of chunk indices already received
}
```

#### 6. transfer_complete

Transfer finished successfully.

```typescript
interface TransferComplete {
  type: 'transfer_complete';
  fileId: string;
  status: 'success' | 'failed';
  checksum?: string;         // Receiver's computed checksum
  error?: string;            // If failed
}
```

---

## Client API (TypeScript)

### SignalingClient

```typescript
import { SignalingClient } from '@fileshare/web-client';

const client = new SignalingClient('wss://signal.fileshare.app/ws');

// Create session
const session = await client.createSession({
  displayName: 'My Device'
});
console.log(session.sessionId, session.token);

// Join session
await client.joinSession({
  sessionId: 'uuid',
  token: 'token',
  displayName: 'My Device'
});

// Listen for events
client.on('offer', (offer) => {
  // Handle WebRTC offer
});

client.on('peer_joined', (peer) => {
  console.log(`${peer.displayName} joined`);
});
```

### WebRTCManager

```typescript
import { WebRTCManager } from '@fileshare/web-client';

const manager = new WebRTCManager({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.fileshare.app:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
});

// Create connection
const peer = await manager.createPeerConnection('peer-id');

// Create data channel
const channel = peer.createDataChannel('file-transfer', {
  ordered: true,
  maxRetransmits: 3
});

// Send offer
const offer = await peer.createOffer();
await peer.setLocalDescription(offer);
signalingClient.send({ type: 'offer', payload: { sdp: offer.sdp } });

// Handle answer
signalingClient.on('answer', async (answer) => {
  await peer.setRemoteDescription(answer);
});
```

### FileStreamManager

```typescript
import { FileStreamManager } from '@fileshare/web-client';

const fileManager = new FileStreamManager({
  chunkSize: 65536,
  bufferThreshold: 16 * 1024 * 1024  // 16 MB
});

// Send file
await fileManager.sendFile({
  file: fileObject,
  dataChannel: channel,
  onProgress: (sent, total) => {
    console.log(`${sent}/${total} bytes sent`);
  },
  onComplete: () => {
    console.log('Transfer complete');
  }
});

// Receive file
await fileManager.receiveFile({
  manifest: fileManifest,
  dataChannel: channel,
  onProgress: (received, total) => {
    console.log(`${received}/${total} bytes received`);
  },
  onComplete: (blob) => {
    // Save blob to disk
  }
});
```

### CryptoManager

```typescript
import { CryptoManager } from '@fileshare/web-client';

const crypto = new CryptoManager();

// Generate keypair
const keypair = crypto.generateKeyPair();

// Perform key exchange
const sharedSecret = crypto.deriveSharedSecret(
  keypair.secretKey,
  peerPublicKey
);

// Derive encryption key
const encryptionKey = await crypto.deriveEncryptionKey(
  sharedSecret,
  sessionId
);

// Encrypt chunk
const encrypted = await crypto.encryptChunk(
  chunkData,
  fileId,
  chunkIndex,
  encryptionKey
);

// Decrypt chunk
const decrypted = await crypto.decryptChunk(
  encryptedChunk,
  fileId,
  chunkIndex,
  encryptionKey
);

// Get fingerprint
const fingerprint = crypto.getFingerprint(
  keypair.publicKey,
  peerPublicKey
);
console.log('Verify:', fingerprint.emoji);  // 🐶🌈🔥🎸🚀📱
```

---

## REST API (Optional)

HTTP endpoints for metadata and monitoring.

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "connections": 42
}
```

### GET /stats

Server statistics (requires auth).

**Response:**
```json
{
  "activeSessions": 127,
  "totalTransfers": 1523,
  "avgThroughput": 12582912,  // bytes/sec
  "turnUsagePercent": 3.2
}
```

---

## WebSocket Lifecycle

```
Client                          Server
──────                          ──────

1. Connect
   WS: ws://signal.example.com/ws
                                 ← Connected (101 Switching Protocols)

2. Create or join session
   → create_session
                                 ← session_created

3. Wait for peer
                                 (Peer joins)
                                 ← peer_joined

4. Exchange WebRTC
   → offer
                                 (Forwarded to peer)
                                 ← answer
                                 (ICE candidates exchanged)

5. DataChannel open
   (Direct P2P connection established)
   
6. Optional: close signaling
   → session_close
                                 ← Connection closed

7. Transfer proceeds over P2P DataChannel
```

---

## Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Create session | 10 | 1 hour |
| Join session | 20 | 1 hour |
| Send message | 100 | 1 minute |
| WebSocket connections | 5 | Per IP |

**Response when rate limited:**
```json
{
  "type": "error",
  "payload": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again in 3600 seconds.",
    "retryAfter": 3600
  }
}
```

---

## SDK Installation

### JavaScript/TypeScript

```bash
npm install @fileshare/client
```

```typescript
import FileShare from '@fileshare/client';

const client = new FileShare({
  signalingServer: 'wss://signal.fileshare.app/ws',
  iceServers: [...]
});

await client.sendFile(file, 'session-id');
```

### Python (Planned)

```bash
pip install fileshare-client
```

```python
from fileshare import Client

client = Client(signaling_url="wss://...")
client.send_file("file.pdf", session_id="...")
```

---

## Changelog

### v1.0.0 (2025-10-28)
- Initial release
- WebRTC-based P2P transfers
- End-to-end encryption
- QR code pairing

---

For more information, see:
- [Architecture](./architecture.md)
- [Security Model](./security.md)
