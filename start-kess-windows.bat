@echo off
chcp 65001 > nul
title KESS - 知識提取與摘要系統

echo ========================================
echo   KESS - Knowledge Extraction System
echo   知識提取與摘要系統 (Windows 優化版)
echo ========================================
echo.

cd /d "%~dp0"

echo 檢查當前目錄: %CD%
echo.

if not exist "package.json" (
    echo [錯誤] 找不到 package.json，請確認在正確的專案目錄下執行
    pause
    exit /b 1
)

echo [資訊] 使用 Node.js 的 OpenSSL Legacy Provider 模式
echo [資訊] 這將確保與舊版加密演算法的相容性
echo.

echo 啟動 KESS 系統...
echo.

node --openssl-legacy-provider src/start.js

echo.
echo 系統已停止
pause
