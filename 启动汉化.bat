@echo off
chcp 65001 >nul
title Cursor-zh Localization Tool
cd /d "%~dp0"
rem widen to 120 columns and cap height at 35 rows
mode con: cols=120 lines=35
set "LOG=%TEMP%\cursor-zh-build.log"

echo ============================================
echo    Cursor-zh - Cursor Localization Tool
echo ============================================
echo.

rem check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

rem first run: install dependencies (logs to %LOG%)
if not exist node_modules (
    echo [First run] Installing dependencies...
    call npm install --no-fund --no-audit >nul 2>"%LOG%"
    if errorlevel 1 (
        echo [ERROR] Dependency install failed. See log: %LOG%
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
)

rem always incremental build so latest source takes effect
echo Building (fast, please wait)...
call npm run build >nul 2>"%LOG%"
if errorlevel 1 (
    echo [ERROR] Build failed. Node.js 18+ required. See log: %LOG%
    pause
    exit /b 1
)

echo.
echo Starting localization menu (admin prompt may appear)...
echo.
node index.js

echo.
pause