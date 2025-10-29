# Start All FileShare Services
# This script starts both the signaling server and web client

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                  FileShare P2P Application                    ║
║                   Starting All Services...                    ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "Starting services in separate windows..." -ForegroundColor Green
Write-Host ""

$scriptDir = $PSScriptRoot

# Start Signaling Server in new window
Write-Host "[1/2] Starting Signaling Server (ws://localhost:8080/ws)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "$scriptDir\start-signaling-server.ps1"

# Wait a bit for signaling server to start
Start-Sleep -Seconds 3

# Start Web Client in new window
Write-Host "[2/2] Starting Web Client (http://localhost:3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", "$scriptDir\start-web-client.ps1"

# Wait for web client to start
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Signaling Server: ws://localhost:8080/ws" -ForegroundColor Cyan
Write-Host "🌐 Web Client:       http://localhost:3000" -ForegroundColor Cyan
Write-Host "📱 Mobile Access:    http://192.168.1.130:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the individual terminal windows to stop each service." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
