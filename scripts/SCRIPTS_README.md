# FileShare Scripts

This directory contains scripts for starting and managing the FileShare application services.

## Available Scripts

### 🚀 Start All Services (Recommended)

```powershell
.\scripts\start-all.ps1
```

This script starts both the signaling server and web client in separate windows. It's the easiest way to run the entire application.

**What it does:**
- Starts the signaling server on `ws://localhost:8080/ws`
- Starts the web client on `http://localhost:3000`
- Opens each service in a separate terminal window for easy monitoring
- Handles dependency installation automatically

### 📡 Start Signaling Server Only

```powershell
.\scripts\start-signaling-server.ps1
```

Starts only the WebSocket signaling server for WebRTC peer connections.

**Features:**
- ✅ Checks for pnpm installation
- ✅ Verifies port 8080 is available
- ✅ Installs dependencies if needed
- ✅ Hot-reloads on code changes (tsx watch mode)
- ✅ Detailed error messages and diagnostics

**Endpoints:**
- WebSocket: `ws://localhost:8080/ws`
- Health Check: `http://localhost:8080/health`
- Stats: `http://localhost:8080/stats`

### 🌐 Start Web Client Only

```powershell
.\scripts\start-web-client.ps1
```

Starts only the React + Vite web client.

**Features:**
- ✅ Checks for pnpm installation
- ✅ Verifies port 3000 is available
- ✅ Installs dependencies if needed
- ✅ Hot-reloads on code changes (Vite HMR)
- ✅ Opens browser automatically

**Access:**
- Local: `http://localhost:3000`
- Mobile (same network): `http://192.168.1.130:3000`

## Troubleshooting

### Port Already in Use

If you see "Port 8080 is already in use" or "Port 3000 is already in use":

```powershell
# Find the process using the port
Get-NetTCPConnection -LocalPort 8080 | ForEach-Object { Get-Process -Id $_.OwningProcess }

# Kill the process (replace <ProcessId> with actual ID)
Stop-Process -Id <ProcessId> -Force
```

### Dependencies Not Installing

If dependencies fail to install:

```powershell
# Navigate to the project root
cd d:\Projects\FileShare

# Clean install all dependencies
pnpm install

# Or install for specific package
cd packages\signaling-server
pnpm install

cd ..\web-client
pnpm install
```

### Server Keeps Crashing

The signaling server now has robust error handling:

1. **Check the logs** - The server outputs detailed error messages
2. **Verify Node.js version** - Requires Node.js 18+ for ESM support
3. **Check for TypeScript errors** - Run `pnpm build` in the signaling-server directory
4. **Restart the server** - Press Ctrl+C and run the start script again

### WebSocket Connection Fails

If the web client can't connect to the signaling server:

1. **Ensure the signaling server is running** - Check that you see "✅ Signaling server started successfully!"
2. **Check firewall settings** - Allow Node.js through Windows Firewall
3. **Verify the URL** - Make sure the client is trying to connect to `ws://localhost:8080/ws`
4. **Check browser console** - Look for WebSocket error messages

## Development Workflow

### Starting from Scratch

```powershell
# 1. Install dependencies (from project root)
pnpm install

# 2. Start all services
.\scripts\start-all.ps1

# Wait for both services to start, then:
# - Open http://localhost:3000 in your browser
# - Test file transfer between two tabs/devices
```

### Making Changes

The scripts use watch mode, so changes to code files will automatically reload:

- **Signaling Server**: tsx watch mode - restarts on .ts file changes
- **Web Client**: Vite HMR - hot-reloads on .tsx/.ts/.css changes

### Production Build

```powershell
# Build the web client for production
cd packages\web-client
pnpm build

# The output will be in packages\web-client\dist
# Deploy this folder to any static hosting service
```

## Requirements

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher (install with `npm install -g pnpm`)
- **Windows**: PowerShell 5.1 or higher (built-in on Windows 10/11)

## Script Behavior

### Exit Codes

- `0` - Success (normal exit)
- `1` - Error (dependency missing, port in use, startup failure)

### Error Handling

All scripts include:
- Dependency validation
- Port availability checks
- Graceful error messages
- User-friendly prompts
- Automatic pause before exit (for error visibility)

### Environment Variables

You can customize behavior with environment variables:

```powershell
# Change signaling server port
$env:PORT = "9000"
.\scripts\start-signaling-server.ps1

# Change log level
$env:LOG_LEVEL = "debug"
.\scripts\start-signaling-server.ps1

# Change CORS origin (production)
$env:CORS_ORIGIN = "https://yourdomain.com"
```

## Quick Reference

| Script | Purpose | Port | Auto-reload |
|--------|---------|------|-------------|
| `start-all.ps1` | Start everything | 8080, 3000 | ✅ |
| `start-signaling-server.ps1` | Signaling server only | 8080 | ✅ |
| `start-web-client.ps1` | Web client only | 3000 | ✅ |

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main [README.md](../README.md)
3. Check the [documentation](../docs/)
4. Open an issue on GitHub
