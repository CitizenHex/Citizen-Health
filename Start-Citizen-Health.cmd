@echo off
setlocal
pushd "%~dp0"
set "NODE_EXE=C:\Users\owner\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  echo Citizen Health could not find its local runtime.
  echo Open this folder in Codex and start the project from there.
  pause
  exit /b 1
)

start "Citizen Health server" /b "%NODE_EXE%" server.js
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173/"
