# Start FileShare Signaling Server
# This script starts the WebSocket signaling server

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║            FileShare Signaling Server - Starting...          ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""

# Navigate to the signaling server directory
$projectRoot = Split-Path $PSScriptRoot -Parent
$serverDir = Join-Path $projectRoot "packages\signaling-server"

if (-not (Test-Path $serverDir)) {
    Write-Host "❌ Error: Signaling server directory not found at: $serverDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Set-Location $serverDir

# Check if pnpm is installed
try {
    $pnpmVersion = pnpm --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Host "✓ pnpm found (v$pnpmVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: pnpm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Install it with: npm install -g pnpm" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found, installing dependencies..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
}

# Check if port 8080 is available
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "❌ Error: Port 8080 is already in use!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Processes using port 8080:" -ForegroundColor Yellow
    Get-Process -Id $portInUse.OwningProcess | Format-Table Id, ProcessName, Path -AutoSize
    Write-Host ""
    Write-Host "To kill the process, run: Stop-Process -Id <ProcessId> -Force" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "📡 Starting Signaling Server..." -ForegroundColor Cyan
Write-Host "   WebSocket: ws://localhost:8080/ws" -ForegroundColor Gray
Write-Host "   Health:    http://localhost:8080/health" -ForegroundColor Gray
Write-Host "   Stats:     http://localhost:8080/stats" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Set environment for development
$env:NODE_ENV = "development"

# Start the server with tsx in watch mode
# tsx will automatically restart on file changes
try {
    npx tsx watch src/index.ts
} catch {
    Write-Host ""
    Write-Host "❌ Server stopped with error" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "Server stopped." -ForegroundColor Yellow
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

