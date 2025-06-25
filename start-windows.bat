@echo off
REM Windows 啟動腳本
echo 啟動 KESS 系統 (Windows 版本)...
cd /d "%~dp0"
node --openssl-legacy-provider src/start.js
