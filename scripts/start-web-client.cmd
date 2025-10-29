@echo off
REM FileShare - Start Web Client
REM This batch file wrapper starts the PowerShell script

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-web-client.ps1"
pause
