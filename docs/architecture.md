# Architecture

## System Overview

The FileShare application is a distributed peer-to-peer system consisting of:

1. **Web Client (PWA)** - Browser-based application with optional native wrappers
2. **Signaling Server** - WebSocket server for peer discovery and WebRTC negotiation
3. **TURN/STUN Servers** - NAT traversal and relay fallback
4. **Optional Relay Store** - Encrypted blob storage for offline transfers

## Component Architecture

### 1. Web Client (PWA)

```
src/app/
├── components/          # React UI components
├── pages/              # Route pages
├── hooks/              # React hooks
├── services/           # Core business logic
│   ├── signaling.ts    # WebSocket signaling client
│   ├── webrtc.ts       # WebRTC peer connection management
│   ├── file-stream.ts  # File chunking & streaming
│   ├── crypto.ts       # E2E encryption
│   └── storage.ts      # IndexedDB persistence
└── utils/              # Helper functions
```

**Key Services:**

#### webrtc.ts
- Creates and manages RTCPeerConnection instances
- Handles ICE candidates and connection states
- Creates DataChannels for file transfer
- Monitors connection quality

#### file-stream.ts
- Chunks files into fixed-size blocks (64KB default)
- Implements backpressure using `bufferedAmount` threshold
- Handles chunk acknowledgments
- Persists transfer progress to IndexedDB
- Implements resume logic

#### signaling.ts
- WebSocket client for signaling server
- Sends/receives SDP offers/answers
- Handles ICE candidate exchange
- Manages session lifecycle

#### crypto.ts
- Ephemeral key exchange using X25519
- Derives shared secret using ECDH
- Encrypts chunks using ChaCha20-Poly1305
- Generates and verifies fingerprints

### 2. Signaling Server

```
src/
├── index.ts           # Server entry point
├── ws-handler.ts      # WebSocket message routing
├── session-store.ts   # In-memory session management
└── routes/            # HTTP routes (health checks)
```

**Responsibilities:**
- Accept WebSocket connections
- Create and manage sessions
- Route SDP offers/answers between peers
- Forward ICE candidates
- Enforce rate limits
- No access to transferred data (encrypted)

**Session Flow:**
```
1. Client A → create_session → Server returns sessionId + token
2. Client B → join_session(sessionId, token) → Success
3. Client A ↔ offer/answer/ice_candidate ↔ Server ↔ Client B
4. WebRTC connection established (P2P)
5. Server connection can be closed (optional keep-alive for reconnect)
```

### 3. TURN/STUN Servers

**STUN (Session Traversal Utilities for NAT):**
- Discovers public IP addresses
- Determines NAT type
- Free public STUN servers available

**TURN (Traversal Using Relays around NAT):**
- Relays traffic when P2P fails
- Required for symmetric NAT scenarios
- Self-hosted coturn instance
- Used as last resort (~1-5% of transfers)

**ICE (Interactive Connectivity Establishment):**
- Tries candidates in order: host → srflx → relay
- Selects best path automatically

### 4. Data Flow

#### Transfer Initiation
```
┌─────────┐                                              ┌─────────┐
│Client A │                                              │Client B │
└────┬────┘                                              └────┬────┘
     │ 1. Create session                                      │
     ├──────────────────────────────────┐                     │
     │                      ┌────────────▼──────────┐         │
     │                      │  Signaling Server     │         │
     │                      └────────────┬──────────┘         │
     │ 2. sessionId + token              │                    │
     │◄──────────────────────────────────┤                    │
     │                                   │                    │
     │ 3. Share sessionId (QR/token/LAN) │                    │
     ├───────────────────────────────────┼───────────────────►│
     │                                   │                    │
     │                                   │ 4. Join session    │
     │                                   │◄───────────────────┤
     │ 5. WebRTC offer                   │                    │
     ├──────────────────────────────────►│                    │
     │                                   │ 6. Forward offer   │
     │                                   ├───────────────────►│
     │                                   │                    │
     │                                   │ 7. WebRTC answer   │
     │                                   │◄───────────────────┤
     │ 8. Forward answer                 │                    │
     │◄──────────────────────────────────┤                    │
     │                                                        │
     │ 9. ICE candidates exchange (via signaling)             │
     │◄──────────────────────────────────────────────────────►│
     │                                                        │
     │ 10. Direct P2P DataChannel established ✓               │
     │═══════════════════════════════════════════════════════►│
```

#### File Transfer Protocol

```
Phase 1: Handshake
─────────────────
A → B: file_manifest { fileId, name, size, chunkSize, chunkCount, checksum }
B → A: manifest_ack { fileId }

Phase 2: Transfer
─────────────────
Loop for each chunk:
  A → B: Binary chunk [Header: fileId(16B) + chunkIndex(4B) + payload(64KB)]
  B → A: chunk_ack { fileId, chunkIndex }
  
  Backpressure control:
  - Monitor peer.bufferedAmount
  - Pause sending if bufferedAmount > threshold (16MB)
  - Resume when bufferedAmount drops

Phase 3: Verification
─────────────────────
B: Verify checksum (SHA-256)
B → A: transfer_complete { fileId, status: "success" }
```

#### Resume Logic

Transfer state persisted in IndexedDB:

```typescript
interface TransferState {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;  // Bitmap or array
  checksum: string;
  peerId: string;
  timestamp: number;
}
```

On reconnect:
1. Load transfer state from IndexedDB
2. Send `resume_request { fileId, receivedChunks }`
3. Sender continues from missing chunks

### 5. Security Architecture

#### End-to-End Encryption

```
1. Key Exchange (ECDH with X25519)
   ─────────────────────────────────
   A: Generate ephemeral keypair (privateA, publicA)
   B: Generate ephemeral keypair (privateB, publicB)
   
   A → B: publicA (via signaling)
   B → A: publicB (via signaling)
   
   A: sharedSecret = ECDH(privateA, publicB)
   B: sharedSecret = ECDH(privateB, publicA)
   
   Both derive: symmetricKey = HKDF(sharedSecret, salt, info)

2. Chunk Encryption (ChaCha20-Poly1305 AEAD)
   ────────────────────────────────────────────
   For each chunk:
     nonce = chunkIndex || fileId  (unique per chunk)
     ciphertext || tag = ChaCha20Poly1305.encrypt(
       key: symmetricKey,
       nonce: nonce,
       plaintext: chunk,
       additionalData: fileMetadata
     )

3. Fingerprint Verification
   ─────────────────────────
   Display: SHA-256(publicA || publicB) as hex or emoji
   Users verify out-of-band (optional but recommended)
```

#### Threat Model

**In Scope:**
- Man-in-the-middle on signaling server (mitigated by E2E encryption)
- Eavesdropping on TURN relay (mitigated by E2E encryption)
- Malicious signaling server (cannot read data; can only DoS)

**Out of Scope (user responsibility):**
- Malware on client device
- Physical device access
- Social engineering

### 6. Performance Considerations

#### Chunking Strategy
- **Chunk size**: 64KB (optimal for WebRTC DataChannel)
- **Buffer threshold**: 16MB (prevent memory overflow)
- **Concurrent chunks**: 1 (sequential to simplify ordering)

#### Memory Management
- Use Streams API (ReadableStream/WritableStream)
- Never load entire file into memory
- Write chunks directly to disk (File System Access API)
- Clean up IndexedDB state after completion

#### Network Optimization
- Enable RTCPeerConnection bundling
- Use RTCP feedback for congestion control
- Adaptive chunk retry on packet loss
- Prefer UDP over TCP for TURN

## Deployment Architecture

### Production Setup

```
                    ┌─────────────────┐
                    │   CDN (Vercel)  │
                    │   Static PWA    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌────────▼────────┐   ┌──────▼──────┐
│  Signaling    │   │   Signaling     │   │  Signaling  │
│  Server 1     │   │   Server 2      │   │  Server 3   │
└───────────────┘   └─────────────────┘   └─────────────┘

        ┌────────────────────┬────────────────────┐
        │                    │                    │
┌───────▼────┐        ┌──────▼─────┐      ┌──────▼─────┐
│  TURN      │        │   TURN     │      │   TURN     │
│  Server 1  │        │  Server 2  │      │  Server 3  │
└────────────┘        └────────────┘      └────────────┘
```

**Scaling Considerations:**
- Signaling servers: stateless, horizontal scaling
- TURN servers: high bandwidth, geographic distribution
- Session store: Redis cluster for multi-instance signaling
- Monitoring: Prometheus + Grafana for metrics

## Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend | React + Vite | Fast dev experience, PWA support |
| Language | TypeScript | Type safety for complex WebRTC code |
| Signaling | Fastify + ws | Lightweight, fast WebSocket handling |
| Desktop | Tauri | Smaller bundle than Electron, Rust backend |
| Mobile | Flutter | Single codebase, native performance |
| TURN | coturn | Open source, proven, self-hosted |
| Crypto | tweetnacl | Audited, lightweight, WASM-optimized |

## Future Enhancements

- **WebTorrent Integration**: Multi-peer downloads, seeding
- **WebTransport**: Replace WebRTC DataChannel (when browser support improves)
- **Offline Relay**: S3-backed encrypted store for async transfers
- **Mesh Networking**: Multi-hop transfers in restricted networks
