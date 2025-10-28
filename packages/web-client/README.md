# FileShare Web Client (PWA)

React + Vite + TypeScript Progressive Web App for P2P file sharing.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
copy .env.example .env.local

# Start development server
pnpm dev
```

Open http://localhost:3000

## Project Structure

```
src/
├── app/
│   └── services/
│       ├── webrtc.ts        # ✅ WebRTC connection manager
│       ├── file-stream.ts   # ✅ File chunking & streaming
│       ├── signaling.ts     # ✅ WebSocket signaling client
│       └── crypto.ts        # ✅ E2E encryption
├── App.tsx                  # ✅ Main app component
├── App.css                  # ✅ Styles
├── index.tsx                # ✅ Entry point
├── index.css                # ✅ Global styles
└── vite-env.d.ts           # ✅ TypeScript definitions
```

## Features Implemented

### Core Services (Ready to Use)

- **✅ WebRTC Manager** (`webrtc.ts`)
  - Peer connection management
  - ICE candidate handling
  - DataChannel creation
  - TURN fallback detection

- **✅ File Stream Manager** (`file-stream.ts`)
  - File chunking (64KB chunks)
  - Backpressure control (16MB buffer)
  - Resume/retry logic
  - Checksum verification
  - IndexedDB persistence

- **✅ Signaling Client** (`signaling.ts`)
  - WebSocket connection with auto-reconnect
  - Session creation/joining
  - SDP offer/answer exchange
  - ICE candidate relay

- **✅ Crypto Manager** (`crypto.ts`)
  - X25519 key exchange
  - ChaCha20-Poly1305 encryption
  - HKDF key derivation
  - Fingerprint verification

### UI Components (Basic Scaffold)

- **✅ Home Page** - Send/Receive buttons
- **🚧 File Picker** - TODO: Implement drag & drop
- **🚧 QR Code** - TODO: Generate/scan QR codes
- **🚧 Transfer Progress** - TODO: Real-time progress UI
- **🚧 Session Management** - TODO: Connect services to UI

## Next Steps (Your Tasks)

### 1. Connect Services to UI (Priority)

Create a transfer manager hook:

```typescript
// src/app/hooks/useTransferManager.ts
import { useState, useEffect } from 'react';
import { WebRTCManager } from '../services/webrtc';
import { SignalingClient } from '../services/signaling';
import { FileStreamManager } from '../services/file-stream';
import { CryptoManager } from '../services/crypto';

export function useTransferManager() {
  const [signaling] = useState(() => new SignalingClient(
    import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:8080/ws'
  ));
  
  const [webrtc] = useState(() => new WebRTCManager({
    iceServers: [
      { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
    ]
  }));
  
  const [fileStream] = useState(() => new FileStreamManager());
  const [crypto] = useState(() => new CryptoManager());
  
  // Add your transfer logic here
  
  return {
    createSession: async () => { /* TODO */ },
    joinSession: async (sessionId: string, token: string) => { /* TODO */ },
    sendFile: async (file: File) => { /* TODO */ },
    // ... more methods
  };
}
```

### 2. Add QR Code Support

```bash
# Already installed in package.json
# qrcode - for generation
# html5-qrcode - for scanning
```

Create QR component:

```typescript
// src/app/components/QRCode.tsx
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRCodeDisplay({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data);
    }
  }, [data]);
  
  return <canvas ref={canvasRef} />;
}
```

### 3. Add File Picker with Drag & Drop

```typescript
// src/app/components/FilePicker.tsx
export function FilePicker({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  return (
    <div
      className="file-picker"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
      }}
    >
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
      <p>Drag & drop or click to select</p>
    </div>
  );
}
```

### 4. Add Transfer Progress UI

```typescript
// src/app/components/TransferProgress.tsx
export function TransferProgress({ 
  progress,
  fileName,
  fileSize 
}: {
  progress: number;
  fileName: string;
  fileSize: number;
}) {
  return (
    <div className="transfer-progress">
      <h3>{fileName}</h3>
      <progress value={progress} max={100} />
      <p>{progress}% - {formatBytes(fileSize)}</p>
    </div>
  );
}
```

## Testing Locally

### 1. Start All Services

**Terminal 1 - Web Client:**
```bash
cd packages/web-client
pnpm dev
```

**Terminal 2 - Signaling Server:**
```bash
cd packages/signaling-server
pnpm dev
```

**Terminal 3 - TURN Server (optional):**
```bash
cd packages/turn
docker-compose --profile test up
```

### 2. Test P2P Transfer

1. Open http://localhost:3000 in Chrome/Edge
2. Open http://localhost:3000 in another window
3. Window 1: Click "Send Files" → select file → copy session info
4. Window 2: Click "Receive Files" → enter session info
5. Watch the transfer complete!

### 3. Debug Tools

- Chrome DevTools → Network → WS (WebSocket messages)
- `chrome://webrtc-internals/` (WebRTC connection details)
- Browser Console (service logs)

## Environment Variables

Create `.env.local`:

```env
VITE_SIGNALING_URL=ws://localhost:8080/ws
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:localhost:3478
VITE_TURN_USERNAME=testuser
VITE_TURN_CREDENTIAL=testpassword
```

## Building for Production

```bash
# Build optimized bundle
pnpm build

# Preview production build
pnpm preview

# Deploy to Vercel
vercel --prod
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests (Vitest)

## Troubleshooting

### TypeScript Errors

The lint errors you see are expected - we need to create the missing components.

### Port Already in Use

```bash
# Use different port
pnpm dev -- --port 3001
```

### WebRTC Connection Fails

1. Check signaling server is running on port 8080
2. Check browser console for errors
3. Use `chrome://webrtc-internals/` to debug
4. Verify environment variables are set

### TURN Server Not Working

1. Ensure Docker is running
2. Check firewall rules allow UDP ports 49152-65535
3. Test with `turnutils-uclient` command

## Resources

- [WebRTC Docs](https://webrtc.org/)
- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev/)
- [Project Architecture](../../docs/architecture.md)
- [API Reference](../../docs/api.md)

## Need Help?

- Check `../../PROJECT_SUMMARY.md` for complete setup
- Review service implementations in `src/app/services/`
- See `../../docs/` for architecture and API docs
- Open an issue on GitHub
