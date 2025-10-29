@echo off
REM FileShare - Start Signaling Server
REM This batch file wrapper starts the PowerShell script

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-signaling-server.ps1"
pause
