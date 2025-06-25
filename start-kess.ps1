# KESS 系統啟動腳本 - Windows
Write-Host "啟動 KESS 系統..." -ForegroundColor Green

# 設定工作目錄
Set-Location "D:\@Projects\sfda_mcpserver\sfda_kess"

# 確認目錄
Write-Host "當前目錄: $(Get-Location)" -ForegroundColor Yellow

# 設定 Node.js 環境變數
$env:NODE_OPTIONS = "--openssl-legacy-provider"

# 啟動系統
Write-Host "執行: node src/start.js" -ForegroundColor Cyan
node src/start.js
