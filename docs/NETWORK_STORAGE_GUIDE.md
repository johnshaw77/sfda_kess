# KESS 網路儲存監控指南

## 概述

KESS 系統現在支援跨平台的 SMB/CIFS 網路磁碟機監控，可以在 Windows、macOS 和 Linux 系統上統一使用相同的設定方式來監控網路共享資料夾。

## 支援的平台

- ✅ **Windows** - 使用 `net use` 命令
- ✅ **macOS** - 使用 `mount -t smbfs` 命令
- ✅ **Linux** - 使用 `mount -t cifs` 命令

## 設定方式

### 1. 環境變數設定 (.env)

```bash
# 啟用網路儲存監控
ENABLE_NETWORK_MONITORING=true

# 設定要監控的網路路徑（多個路徑用逗號分隔）
NETWORK_PATHS=smb://10.1.1.127/shared,smb://10.1.1.127/documents

# 網路連線設定
NETWORK_RETRY_ATTEMPTS=3
NETWORK_RETRY_DELAY=5000
NETWORK_CONNECTION_TIMEOUT=30000
ENABLE_AUTO_MOUNT=true
MOUNT_TIMEOUT=60000
```

### 2. 支援的網路路徑格式

```bash
# SMB/CIFS 格式（推薦）
smb://10.1.1.127/shared
smb://10.1.1.127/documents

# UNC 格式（Windows 風格）
//10.1.1.127/shared
//10.1.1.127/documents
```

## 功能特色

### 🔄 自動掛載

系統會自動檢測並掛載網路磁碟機：

- **Windows**: 自動分配可用磁碟機代號 (Z:, Y:, X:...)
- **macOS**: 掛載到 `/Volumes/主機名_共享名`
- **Linux**: 掛載到 `/mnt/主機名_共享名`

### 📊 智能輪詢

由於網路磁碟機的文件變更通知可能不可靠，系統使用智能輪詢機制：

- 預設 5 秒間隔掃描
- 支援遞迴掃描子目錄
- 自動跳過系統檔案和暫存檔

### 🛡️ 錯誤處理

- 自動重試機制
- 網路中斷自動恢復
- 詳細的錯誤日誌

## 使用步驟

### 1. 設定網路路徑

編輯 `.env` 檔案：

```bash
ENABLE_NETWORK_MONITORING=true
NETWORK_PATHS=smb://10.1.1.127/shared
```

### 2. 測試網路連線

```bash
# 測試網路儲存監控
npm run test:network

# 或直接執行
node scripts/test-network-monitoring.js
```

### 3. 啟動完整監控

```bash
# 啟動 KESS 系統（包含網路監控）
npm start

# 或
node src/start.js
```

## 平台特定設定

### Windows

```bash
# 確保有管理員權限（某些情況下需要）
# 設定 Windows 認證（如果需要）
net use \\\\10.1.1.127\\shared /user:username password
```

### macOS

```bash
# 確保有必要的權限
# 可能需要在「系統偏好設定」中授權檔案存取權限
sudo mkdir -p /Volumes/10.1.1.127_shared
```

### Linux

```bash
# 安裝 CIFS 工具
sudo apt-get install cifs-utils  # Ubuntu/Debian
sudo yum install cifs-utils      # CentOS/RHEL

# 建立掛載點
sudo mkdir -p /mnt/10.1.1.127_shared
```

## 監控狀態檢查

### 透過管理腳本

```bash
npm run status
```

### 透過 API（如果有啟用）

```bash
curl http://localhost:3000/api/status
```

### 透過日誌

```bash
tail -f logs/kess.log | grep "SMB"
```

## 故障排除

### 連線問題

1. **檢查網路連通性**:

   ```bash
   ping 10.1.1.127
   ```

2. **檢查 SMB 服務**:

   ```bash
   # Windows
   telnet 10.1.1.127 445

   # macOS/Linux
   nc -zv 10.1.1.127 445
   ```

3. **檢查權限**:
   - 確保使用者有讀取網路共享的權限
   - 檢查防火牆設定

### 掛載問題

1. **Windows**: 檢查是否有可用的磁碟機代號
2. **macOS**: 檢查 `/Volumes` 目錄權限
3. **Linux**: 檢查 `cifs-utils` 是否安裝

### 監控問題

1. **檢查日誌**:

   ```bash
   grep "SMB\|NETWORK" logs/kess.log
   ```

2. **手動測試掛載點**:
   ```bash
   ls -la /path/to/mount/point
   ```

## 性能優化

### 調整輪詢間隔

```bash
# 減少網路負載（增加間隔）
POLLING_INTERVAL=10000  # 10秒

# 提高響應速度（減少間隔）
POLLING_INTERVAL=2000   # 2秒
```

### 限制監控範圍

```bash
# 只監控特定檔案類型
SUPPORTED_EXTENSIONS=.pdf,.docx,.xlsx

# 設定檔案大小限制
MAX_FILE_SIZE=5242880  # 5MB
```

## 安全考量

1. **認證**: 建議使用只讀帳戶存取網路共享
2. **網路隔離**: 確保監控的網路共享在安全的網段
3. **日誌監控**: 定期檢查存取日誌，確保沒有異常行為

## 範例設定

### 完整的 .env 範例

```bash
# 基本設定
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sfda_nexus
DB_USER=root
DB_PASSWORD=MyPwd@1234

# LLM 設定
LLM_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen3:14b

# 本地監控
WATCH_FOLDERS=/Users/johnshaw77/Documents/flexium/品質系統文件

# 網路儲存監控
ENABLE_NETWORK_MONITORING=true
NETWORK_PATHS=smb://10.1.1.127/shared
POLLING_INTERVAL=5000
MAX_FILE_SIZE=10485760
SUPPORTED_EXTENSIONS=.txt,.md,.pdf,.docx,.doc,.xlsx,.xls,.rtf

# 網路設定
NETWORK_RETRY_ATTEMPTS=3
NETWORK_RETRY_DELAY=5000
NETWORK_CONNECTION_TIMEOUT=30000
ENABLE_AUTO_MOUNT=true
MOUNT_TIMEOUT=60000
```

這樣的設定可以讓您的 KESS 系統同時監控本地檔案和網路共享檔案，並且在不同的作業系統上都能正常運作。
