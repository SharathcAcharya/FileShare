# Security Model

## Overview

FileShare implements defense-in-depth with end-to-end encryption, secure key exchange, and privacy-by-design principles. The server infrastructure never has access to plaintext file data.

## Threat Model

### Assets
- User files (any type, any size)
- User device identities
- Session metadata (who transferred what, when)

### Adversaries
1. **Network eavesdropper** - Passive observer on network path
2. **Malicious signaling server** - Compromised or malicious relay server
3. **TURN relay operator** - TURN server logging/inspecting traffic
4. **Man-in-the-middle** - Active attacker intercepting/modifying messages

### Assumptions
- Client devices are trusted and not compromised
- Users verify fingerprints for high-security transfers
- Cryptographic primitives (X25519, ChaCha20-Poly1305) are secure

## Security Architecture

### 1. End-to-End Encryption

All file data is encrypted on the sender's device and decrypted only on the receiver's device.

#### Key Exchange (ECDH with X25519)

```
Sender (Alice)                                    Receiver (Bob)
──────────────                                    ───────────────

1. Generate ephemeral keypair
   privateA = random(32 bytes)
   publicA = X25519.base(privateA)                Generate ephemeral keypair
                                                  privateB = random(32 bytes)
                                                  publicB = X25519.base(privateB)

2. Exchange public keys (via signaling server)
   ──────────────────► publicA ──────────────────►
   ◄────────────────── publicB ◄──────────────────

3. Derive shared secret
   sharedSecret = X25519(privateA, publicB)       sharedSecret = X25519(privateB, publicA)

4. Derive symmetric key using HKDF
   salt = sessionId (32 bytes)
   info = "FileShare-v1-ChaCha20"
   symmetricKey = HKDF-SHA256(sharedSecret, salt, info, 32)

5. Compute fingerprint for verification
   fingerprint = SHA256(publicA || publicB)
   Display as: hex or emoji sequence
```

**Properties:**
- Perfect Forward Secrecy (PFS) - Keys are ephemeral, session-specific
- No key escrow - Server never sees private keys or shared secret
- Post-compromise security - Past sessions remain secure even if current key is leaked

#### Chunk Encryption (ChaCha20-Poly1305 AEAD)

Each file chunk is encrypted individually:

```typescript
interface ChunkHeader {
  fileId: string;        // 16 bytes (UUID)
  chunkIndex: number;    // 4 bytes
  chunkSize: number;     // 4 bytes (actual payload size)
}

// Nonce construction (unique per chunk)
nonce = SHA256(fileId || chunkIndex)[0:12]  // 96 bits for ChaCha20

// Encryption
const additionalData = encode(fileId, fileName, chunkIndex);
const { ciphertext, tag } = ChaCha20Poly1305.encrypt({
  key: symmetricKey,
  nonce: nonce,
  plaintext: chunkData,
  additionalData: additionalData  // Authenticated but not encrypted
});

// Send: Header || Ciphertext || Tag
wireFormat = ChunkHeader || ciphertext || tag (16 bytes)
```

**Properties:**
- Authenticated Encryption with Associated Data (AEAD)
- Chunk-level integrity verification
- Unique nonce per chunk prevents replay attacks
- Parallel encryption/decryption possible

### 2. Signaling Security

#### Session Creation

```
Client A                    Signaling Server
────────                    ────────────────

1. Request: create_session
   {
     clientId: randomUUID(),
     timestamp: Date.now()
   }

2. Response: session_created
   {
     sessionId: randomUUID(),       // 128-bit session identifier
     token: randomBytes(32),        // 256-bit secret token
     expiresAt: timestamp + 1h      // Short-lived session
   }

3. Share sessionId + token with peer (QR/manual/LAN)

Client B                    Signaling Server
────────                    ────────────────

4. Request: join_session
   {
     sessionId: sessionId,
     token: token,
     clientId: randomUUID()
   }

5. Server validates token matches sessionId
   If valid: accept connection and relay messages
   If invalid: reject with error
```

**Security Measures:**
- Short-lived sessions (1 hour default, configurable)
- High-entropy tokens (256 bits)
- Rate limiting on session creation (10/hour per IP)
- Token required for joining (prevents session hijacking)

#### Message Authentication

All signaling messages include:
```typescript
interface SignalingMessage {
  type: string;
  sessionId: string;
  from: string;           // Sender clientId
  to: string;             // Recipient clientId
  timestamp: number;
  signature?: string;     // Optional: HMAC-SHA256(message, sessionToken)
}
```

**Protections:**
- Server validates sessionId exists and not expired
- Server validates `from` matches WebSocket connection ID
- Timestamp checked within 5-minute window (prevent replay)
- Optional HMAC prevents message tampering

### 3. Pairing Mechanisms

#### QR Code Pairing

```
1. Sender generates QR code containing:
   {
     "v": 1,                              // Version
     "s": "sessionId",                    // Session ID
     "t": "base64(token)",               // Session token
     "f": "base64(publicKey)",           // Sender's public key
     "sig": "base64(signature)"          // Self-signed proof
   }

2. Receiver scans QR code
3. Receiver validates signature
4. Receiver joins session with token
5. Both sides verify fingerprint (SHA256(pubA || pubB))
```

**Security:**
- Physical proximity required (camera must see QR)
- Short display time (60 seconds)
- One-time use tokens
- Fingerprint verification recommended

#### Numeric Token Pairing

```
1. Sender displays: "Session 8H4J-9K2P"
   (sessionId encoded as short alphanumeric)
   
2. Sender also shows: 6-digit PIN (derived from token)
   PIN = numericEncode(HMAC-SHA256(token, "PIN")[0:3])
   
3. Receiver enters: session code + PIN
4. Server validates both match
```

**Security:**
- 36^8 ≈ 2.8 trillion session code combinations
- 10^6 = 1 million PIN combinations
- Rate limiting: 3 attempts per minute
- Brute force infeasible within session lifetime

#### Local LAN Discovery (mDNS)

```
1. Sender broadcasts mDNS advertisement:
   _fileshare._tcp.local
   TXT: sessionId=<id>&pubkey=<key>&name=<deviceName>

2. Receiver discovers via mDNS query
3. Receiver connects to signaling server with sessionId
4. E2E encryption handshake proceeds normally
```

**Security:**
- Only works on trusted local networks
- Still requires E2E encryption
- Vulnerable to local network attackers (use fingerprint verification)
- Option to disable in security settings

### 4. Privacy Protections

#### Zero-Knowledge Server

The signaling server operates on a zero-knowledge principle:

**Server CANNOT:**
- ❌ Read file contents (encrypted end-to-end)
- ❌ See file names (encrypted in file manifest)
- ❌ Determine file types or sizes (encrypted metadata)
- ❌ Derive encryption keys (ECDH computed client-side)

**Server CAN:**
- ✅ See sessionId, clientIds (necessary for routing)
- ✅ See connection timestamps and duration
- ✅ See signaling message count (for rate limiting)
- ✅ See IP addresses (necessary for WebSocket connection)

**Mitigation:**
- Minimal logging (only errors, no session content)
- Log rotation and deletion after 7 days
- No persistent user accounts (anonymous sessions)
- Optional Tor/VPN support for IP anonymity

#### TURN Relay Privacy

When TURN relay is required:

```
Sender → TURN Server → Receiver
        (encrypted)
```

- TURN server relays encrypted packets
- Cannot decrypt (no access to E2E keys)
- Sees only: source IP, destination IP, packet sizes, timing
- Mitigation: Self-host TURN or use trusted provider

#### Metadata Minimization

File manifest is encrypted within the E2E channel:

```typescript
// Sent over encrypted DataChannel (not via signaling)
const encryptedManifest = encrypt({
  fileId: uuid(),
  fileName: "document.pdf",    // Only receiver knows
  fileSize: 1048576,
  mimeType: "application/pdf",
  checksum: "sha256:..."
});
```

### 5. Attack Mitigations

#### Man-in-the-Middle (MITM)

**Scenario:** Attacker intercepts key exchange and substitutes own keys

**Mitigations:**
1. **Fingerprint Verification** (primary defense)
   ```
   Display: "Verify: 🐶🌈🔥🎸🚀📱"
   (Both sides must see identical emoji sequence)
   ```
   
2. **Trust-On-First-Use (TOFU)** (for repeat transfers)
   ```
   Store: { peerId, publicKey, lastSeen }
   Warn if public key changes for known peerId
   ```

3. **QR Code Binding** (physical channel)
   ```
   QR includes sender's public key
   Receiver validates key matches during handshake
   ```

#### Replay Attacks

**Scenario:** Attacker captures and replays encrypted chunks

**Mitigations:**
- Unique nonce per chunk (fileId || chunkIndex)
- ChaCha20-Poly1305 AEAD prevents undetected tampering
- Chunk acknowledgments include sequence numbers
- Timestamp validation in signaling messages

#### Denial of Service (DoS)

**Scenario:** Attacker floods signaling server or TURN relay

**Mitigations:**
- Rate limiting: 10 sessions/hour per IP
- Connection limits: 100 concurrent per server
- TURN authentication: username/password required
- Auto-scaling and load balancing
- CloudFlare/DDoS protection on signaling server

#### Session Hijacking

**Scenario:** Attacker guesses sessionId and joins session

**Mitigations:**
- 256-bit session token required (not just sessionId)
- Token never transmitted in clear (TLS for signaling)
- One-time token consumption (can't reuse after join)
- Short session lifetime (1 hour)

### 6. Compliance & Abuse Prevention

#### Content Scanning

FileShare does NOT scan content (by design):
- End-to-end encryption prevents server-side scanning
- User responsibility to comply with laws
- Terms of Service prohibit illegal content

#### Abuse Reporting

```
1. Recipient can report sender's IP/sessionId
2. Moderation team investigates based on:
   - Reporter credibility
   - Pattern of reports against same IP
   - Law enforcement requests
3. Actions: IP ban, rate limit, account suspension (if accounts exist)
```

#### DMCA Takedown Process

Since server cannot see content:
- Takedown requests must specify: sessionId, timestamp, sender IP
- We can ban sender IP but cannot remove "content" (it's P2P)
- Provide tools for recipients to verify sender authenticity

### 7. Security Best Practices

#### For Users

✅ **DO:**
- Verify fingerprints for sensitive transfers
- Use QR codes for in-person transfers
- Keep devices updated and malware-free
- Use trusted networks or VPN
- Enable TOFU warnings for repeat contacts

❌ **DON'T:**
- Share session tokens over insecure channels (SMS, email)
- Ignore fingerprint mismatches
- Accept files from unknown/untrusted senders
- Disable encryption (not possible by design)

#### For Operators

✅ **DO:**
- Use TLS 1.3 for signaling server
- Enable HSTS, CSP headers on web client
- Rotate TURN credentials regularly
- Monitor for suspicious patterns
- Keep dependencies updated
- Run security audits annually

❌ **DON'T:**
- Log session tokens or encryption keys
- Store user files (even temporarily)
- Disable rate limiting in production
- Use weak TURN credentials

### 8. Cryptographic Implementation

#### Library Choices

| Purpose | Library | Rationale |
|---------|---------|-----------|
| X25519 Key Exchange | tweetnacl-js | Audited, constant-time, WASM-optimized |
| ChaCha20-Poly1305 | tweetnacl-js | Fast, secure AEAD cipher |
| SHA-256 Hashing | Web Crypto API | Native browser implementation |
| Random Number Generation | Web Crypto API | Cryptographically secure PRNG |

#### Key Derivation

```typescript
// HKDF-SHA256 implementation
async function deriveKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  info: string
): Promise<CryptoKey> {
  const importedKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new TextEncoder().encode(info)
    },
    importedKey,
    256  // 32 bytes
  );
  
  return crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM' },  // or ChaCha20 if available
    false,
    ['encrypt', 'decrypt']
  );
}
```

### 9. Security Audit Checklist

- [ ] Dependency vulnerability scan (npm audit, Snyk)
- [ ] Static analysis (ESLint security rules, Semgrep)
- [ ] Penetration testing (OWASP Top 10)
- [ ] Cryptographic review by expert
- [ ] Side-channel attack analysis
- [ ] DoS/load testing
- [ ] Privacy policy legal review
- [ ] Incident response plan
- [ ] Bug bounty program setup

### 10. Incident Response

**If Vulnerability Discovered:**

1. **Assess severity** (CVSS score)
2. **Patch immediately** if critical
3. **Notify users** via in-app alert
4. **Rotate infrastructure secrets**
5. **Post-mortem** within 48 hours
6. **Public disclosure** after 90 days (responsible disclosure)

**Emergency Contacts:**
- Security team: security@fileshare.app
- Bug bounty: hackerone.com/fileshare

---

## Conclusion

FileShare's security model prioritizes user privacy through end-to-end encryption, minimal server knowledge, and defense-in-depth. The system is designed such that even a compromised server cannot access user data.

For questions or security concerns, contact: security@fileshare.app
