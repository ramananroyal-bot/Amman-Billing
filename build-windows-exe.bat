@echo off
setlocal enabledelayedexpansion

echo ================================================================
echo   Amman Billing ^& Accounting - Windows .EXE Builder
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Download Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

echo [1/4] Installing application dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/4] Ensuring Electron and Electron Builder are installed...
if not exist "node_modules\electron" (
  call npm install --no-save electron electron-builder
  if errorlevel 1 (
    echo [ERROR] Failed to install Electron packaging tools.
    pause
    exit /b 1
  )
)

echo.
echo [3/4] Building production web bundle...
call npm run build
if errorlevel 1 (
  echo [ERROR] Production build failed.
  pause
  exit /b 1
)

echo.
echo [4/4] Packaging Windows Installer (.exe) and Portable (.exe)...
call npx electron-builder --win nsis portable
if errorlevel 1 (
  echo [ERROR] Electron Builder packaging failed.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo   SUCCESS! Installers generated inside the "release" folder:
echo   - release\Amman-Billing-Setup-1.0.0.exe
echo   - release\Amman-Billing-1.0.0-portable.exe
echo ================================================================
pause
