# P2P File Sharing App

A cross-platform peer-to-peer file sharing application that enables secure, frictionless file transfers of any size across all platforms.

## 🎯 Project Overview

Installable PWA + optional native wrappers for secure peer-to-peer file transfers (any size, any file type) across Android, iOS, Windows, macOS, and Linux with local discovery, QR/pairing, chunked resume, and TURN relay fallback.

## ✨ Features

### MVP
- ✅ Installable PWA (desktop & mobile)
- ✅ WebRTC DataChannel transfers with chunking, backpressure, and resume
- ✅ QR code + numeric token pairing
- ✅ Local LAN discovery (mDNS/UDP)
- ✅ STUN + TURN fallback
- ✅ End-to-end encryption per session
- ✅ Transfer history and retry/resume

### v1 (Planned)
- Native desktop wrappers (Tauri)
- Android/iOS native wrappers
- WebTorrent seed mode for multi-peer
- Persistent trusted devices (TOFU)
- Background seeding
- Shareable encrypted links with TTL

### v2 (Future)
- Bandwidth quotas
- Scheduled transfers
- Device groups
- Analytics dashboard
- TURN relays marketplace

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Client A  │◄───────►│ Signaling Server │◄───────►│   Client B  │
│   (Browser) │         │   (WebSocket)    │         │   (Browser) │
└──────┬──────┘         └──────────────────┘         └──────┬──────┘
       │                                                      │
       │                  ┌──────────────┐                   │
       └─────────────────►│  STUN/TURN   │◄──────────────────┘
                          │   (coturn)   │
                          └──────────────┘
              WebRTC DataChannel (P2P encrypted transfer)
```

## 🛠️ Tech Stack

- **Frontend**: React + Vite + TypeScript
- **WebRTC**: Native RTCPeerConnection + DataChannel
- **Signaling**: Node.js + Fastify + ws (WebSocket)
- **TURN/STUN**: coturn (self-hosted)
- **Desktop**: Tauri
- **Mobile**: Flutter or React Native
- **Crypto**: tweetnacl (X25519, ChaCha20-Poly1305)
- **Storage**: IndexedDB, File System Access API
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel/Netlify (PWA), DigitalOcean/AWS (signaling)

## 📦 Monorepo Structure

```
fileshare/
├── packages/
│   ├── web-client/          # PWA (React + TypeScript)
│   ├── signaling-server/    # WebSocket signaling server
│   ├── turn/                # coturn configuration
│   ├── desktop/             # Tauri wrapper
│   ├── mobile/              # Flutter/RN wrappers
│   ├── utils/               # Shared libraries
│   └── infra/               # Terraform/K8s configs
├── scripts/                 # Dev scripts
└── docs/                    # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker (for signaling server & TURN)

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Build all packages
pnpm build
```

### Development

```bash
# Web client (PWA)
cd packages/web-client
pnpm dev

# Signaling server
cd packages/signaling-server
pnpm dev

# TURN server
cd packages/turn
docker-compose up
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Run load tests
pnpm test:load
```

## 📋 Roadmap

### Sprint 0 — Project Setup (Week 1)
- [x] Repo scaffolding
- [x] CI pipeline
- [x] TypeScript config
- [x] Monorepo tooling

### Sprint 1 — WebRTC P2P PoC (Week 2)
- [ ] Browser-to-browser chunked transfer
- [ ] Basic signaling server
- [ ] Manual transfer tests

### Sprint 2 — Large File Streaming (Week 3)
- [ ] Chunking + backpressure
- [ ] File System Access API
- [ ] Resume logic
- [ ] Test with >1GB files

### Sprint 3 — Discovery & Pairing (Week 4)
- [ ] QR code pairing
- [ ] Numeric token flow
- [ ] Local LAN discovery

### Sprint 4 — Encryption & Security (Week 5)
- [ ] E2E encryption (X25519 + ChaCha20)
- [ ] Fingerprint verification
- [ ] Secure signaling (TLS)

### Sprint 5 — PWA Polish (Week 6)
- [ ] Installable PWA
- [ ] Service worker
- [ ] Drag & drop UI
- [ ] Progress tracking

### Sprint 6 — TURN Fallback (Week 7)
- [ ] Deploy coturn
- [ ] TURN integration
- [ ] NAT traversal tests

### Sprint 7-8 — Native Wrappers (Week 8-9)
- [ ] Tauri desktop app
- [ ] Mobile wrapper prototype

### Sprint 9 — Beta Release (Week 10)
- [ ] E2E test suite
- [ ] Security review
- [ ] Beta deployment

## 🔒 Security

- End-to-end encryption by default
- Ephemeral key exchange (X25519)
- Chunk-level encryption (ChaCha20-Poly1305)
- Short-lived session tokens
- No plaintext server storage
- Rate limiting & abuse detection

## 📊 KPIs

- Transfer success rate: >95%
- Median throughput: >10 MB/s
- P2P percentage: >99%
- PWA install conversion: >20%
- Crash/error rate: <1%

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 📚 Documentation

- [Architecture](./docs/architecture.md)
- [Security Model](./docs/security.md)
- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## 🆘 Support

- Issues: [GitHub Issues](https://github.com/your-org/fileshare/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/fileshare/discussions)
