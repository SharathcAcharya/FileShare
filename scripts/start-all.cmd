@echo off
REM FileShare - Start All Services
REM This batch file starts both the signaling server and web client

cd /d "%~dp0"

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                  FileShare P2P Application                    ║
echo ║                   Starting All Services...                    ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Starting services in separate windows...
echo.

REM Start Signaling Server
echo [1/2] Starting Signaling Server...
start "FileShare Signaling Server" cmd /k "cd /d %~dp0 && start-signaling-server.cmd"

REM Wait a bit
timeout /t 3 /nobreak >nul

REM Start Web Client
echo [2/2] Starting Web Client...
start "FileShare Web Client" cmd /k "cd /d %~dp0 && start-web-client.cmd"

REM Wait for startup
timeout /t 5 /nobreak >nul

echo.
echo ✅ All services started!
echo.
echo 📡 Signaling Server: ws://localhost:8080/ws
echo 🌐 Web Client:       http://localhost:3000
echo 📱 Mobile Access:    http://192.168.1.130:3000
echo.
echo Close the individual terminal windows to stop each service.
echo.
pause
