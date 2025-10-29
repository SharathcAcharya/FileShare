# FileShare - Quick Start Guide

Welcome to FileShare! This guide will help you get the application up and running in minutes.

## 📋 Prerequisites

Before you start, make sure you have:

- **Node.js** v18.0.0 or higher ([Download](https://nodejs.org/))
- **pnpm** v8.0.0 or higher (install with `npm install -g pnpm`)
- **Windows 10/11** with PowerShell

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

Open PowerShell in the project root and run:

```powershell
pnpm install
```

This will install all dependencies for all packages in the monorepo.

### Step 2: Start the Application

Double-click on one of these files in the `scripts` folder:

- **`start-all.cmd`** - Starts everything (recommended for first-time users)
- **`start-signaling-server.cmd`** - Starts only the signaling server
- **`start-web-client.cmd`** - Starts only the web client

Or run in PowerShell:

```powershell
# Start everything
.\scripts\start-all.ps1

# Or start individual services
.\scripts\start-signaling-server.ps1
.\scripts\start-web-client.ps1
```

### Step 3: Open Your Browser

Once both services are running, open your browser to:

**http://localhost:3000**

You should see the FileShare interface!

## 🎯 Testing File Transfer

### Same Device (Two Tabs)

1. Open http://localhost:3000 in two browser tabs
2. In **Tab 1** (Sender):
   - Click "Create Session"
   - Select a file
   - Note the Session ID displayed
3. In **Tab 2** (Receiver):
   - Click "Join Session"
   - Enter the Session ID from Tab 1
   - Click "Join"
4. Back in **Tab 1**:
   - Click "Send File"
   - Watch the transfer progress!

### Different Devices (Same Network)

1. **Sender Device**:
   - Open http://localhost:3000
   - Click "Create Session"
   - Select a file
   - Click "Show QR Code"
   
2. **Receiver Device**:
   - Open http://192.168.1.130:3000 (or your computer's local IP)
   - Click "Join Session"
   - Click "Scan QR Code"
   - Point camera at the QR code
   - Accept the file when prompted

## 📡 What's Running?

When you start the application, these services launch:

### Signaling Server (Port 8080)
- **Purpose**: Coordinates WebRTC peer connections
- **Endpoints**:
  - `ws://localhost:8080/ws` - WebSocket endpoint
  - `http://localhost:8080/health` - Health check
  - `http://localhost:8080/stats` - Server statistics

### Web Client (Port 3000)
- **Purpose**: User interface for file transfers
- **Access**:
  - `http://localhost:3000` - Local access
  - `http://192.168.1.130:3000` - Network access (replace with your IP)

## 🔧 Troubleshooting

### "Port already in use" Error

If you see an error about ports 8080 or 3000 being in use:

```powershell
# Find processes using the ports
Get-NetTCPConnection -LocalPort 8080
Get-NetTCPConnection -LocalPort 3000

# Kill a process (replace <ProcessId> with actual ID)
Stop-Process -Id <ProcessId> -Force
```

### Signaling Server Won't Start

1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies:
   ```powershell
   cd packages\signaling-server
   Remove-Item -Recurse -Force node_modules
   pnpm install
   ```
3. Check for TypeScript errors:
   ```powershell
   cd packages\signaling-server
   npx tsc --noEmit
   ```

### Web Client Won't Start

1. Check that pnpm is installed: `pnpm --version`
2. Reinstall dependencies:
   ```powershell
   cd packages\web-client
   Remove-Item -Recurse -Force node_modules
   pnpm install
   ```

### WebSocket Connection Fails

1. **Ensure signaling server is running** - Look for the message:
   ```
   ✅ Signaling server started successfully!
   📡 WebSocket endpoint: ws://0.0.0.0:8080/ws
   ```

2. **Check Windows Firewall** - Allow Node.js through the firewall:
   - Windows Security → Firewall & network protection
   - Allow an app through firewall
   - Find "Node.js" and enable for Private networks

3. **Check browser console** - Press F12 and look for WebSocket errors

### File Transfer Fails

1. **Check browser compatibility** - FileShare requires a modern browser:
   - Chrome 90+
   - Edge 90+
   - Firefox 88+
   - Safari 15+

2. **Check file size** - Very large files (>2GB) may have issues
   - Try with a smaller test file first

3. **Check network** - Both devices must be on the same network
   - Verify connectivity: `ping <other-device-ip>`

## 🎨 Features

### ✅ What Works

- **P2P File Transfer** - Direct device-to-device transfer
- **End-to-End Encryption** - All files encrypted with X25519 + ChaCha20-Poly1305
- **Resume Support** - Transfer can resume after disconnection
- **QR Code Sharing** - Easy session sharing between devices
- **Progress Tracking** - Real-time speed, ETA, and progress
- **Drag & Drop** - Simple file selection
- **PWA Support** - Install as a Progressive Web App
- **No Server Storage** - Files never touch the server

### 🔐 Security

- All files are encrypted end-to-end
- Encryption keys are generated locally and never leave your device
- Keys are exchanged using X25519 ECDH
- Files are encrypted with ChaCha20-Poly1305 AEAD
- Session tokens are cryptographically random
- No data is stored on the signaling server

### 📱 Mobile Support

The web client is fully responsive and works on mobile devices:

1. Find your computer's local IP address:
   ```powershell
   (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
   ```

2. On your mobile device's browser, visit:
   ```
   http://<your-ip>:3000
   ```

## 📚 Additional Resources

- **Architecture Documentation**: `docs/architecture.md`
- **API Documentation**: `docs/api.md`
- **Security Details**: `docs/security.md`
- **Deployment Guide**: `docs/deployment.md`
- **Scripts Documentation**: `scripts/SCRIPTS_README.md`

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in the terminal windows
3. Check the browser console (F12) for errors
4. Review the documentation in the `docs` folder
5. Ensure all prerequisites are met

## 🎉 Success!

Once you see:

```
✅ Signaling server started successfully!
📡 WebSocket endpoint: ws://0.0.0.0:8080/ws
```

And:

```
VITE v5.4.21  ready in 667 ms
➜  Local:   http://localhost:3000/
```

You're ready to start transferring files! Open http://localhost:3000 and try it out.

## 🔄 Updates

To update the application:

```powershell
# Pull latest changes (if using git)
git pull

# Update dependencies
pnpm install

# Rebuild
cd packages\web-client
pnpm build
```

## 🛑 Stopping the Application

To stop all services:

1. Close the terminal windows, or
2. Press `Ctrl+C` in each terminal window

The scripts handle graceful shutdown automatically.

---

**Enjoy using FileShare! 🚀**
