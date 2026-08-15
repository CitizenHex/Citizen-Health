@echo off
setlocal
pushd "%~dp0"
set "NODE_EXE=%~dp0runtime\node.exe"

if not exist "%NODE_EXE%" (
  echo Citizen Health could not find its included runtime.
  echo Please extract the complete Citizen Health ZIP before starting it.
  pause
  exit /b 1
)

start "Citizen Health server" /b "%NODE_EXE%" server.js
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173/"
