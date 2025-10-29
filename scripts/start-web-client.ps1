# Start Web Client Development Server
# This script starts the Vite dev server for the web client

Write-Host "Starting FileShare Web Client..." -ForegroundColor Green
Write-Host "Client will run on http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

Set-Location "$PSScriptRoot\..\packages\web-client"

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pnpm install
}

# Start the dev server
pnpm dev --host
