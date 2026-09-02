@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%MINIMAX_H3_PROJECT_DIR%"
if not defined PROJECT_DIR set "PROJECT_DIR=%SCRIPT_DIR%..\runtime"

if not exist "%PROJECT_DIR%\scripts\h3-onboard.mjs" (
  echo MiniMax H3 Cloud runtime is incomplete: %PROJECT_DIR% 1>&2
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required and must be available on PATH. 1>&2
  exit /b 1
)

node "%PROJECT_DIR%\scripts\h3-onboard.mjs" %*
exit /b %ERRORLEVEL%
