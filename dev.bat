@echo off
REM 開發模式啟動腳本 - Windows
echo 啟動 KESS 系統開發模式...
cd /d "%~dp0"
echo 當前目錄: %CD%
echo.
nodemon --exec "node --openssl-legacy-provider" src/start.js
pause
