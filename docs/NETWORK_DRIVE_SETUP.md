# KESS 網路磁碟機監控使用指南

## 概述

KESS（知識提取與摘要系統）支援透過 VPN 連線監控公司網路磁碟機。本指南說明如何在 macOS 上設定和使用此功能。

## 設定步驟

### 1. 建立 VPN 連線

1. 開啟「系統偏好設定」→「網路」
2. 點擊左下角的「+」按鈕
3. 介面選擇「VPN」
4. VPN 類型選擇（根據公司 IT 提供的資訊）：
   - IKEv2（推薦，較安全）
   - L2TP over IPSec
   - PPTP（較不安全，不建議）
5. 輸入連線資訊：
   - 伺服器位址：公司 VPN 伺服器 IP 或域名
   - 帳號：您的公司帳號
   - 密碼：您的公司密碼
6. 點擊「套用」儲存設定

### 2. 修改掛載腳本設定

編輯 `scripts/mount-network-drives.sh`：

```bash
# 修改這些變數
SERVER_IP="192.168.1.100"  # 公司檔案伺服器 IP
USERNAME="your_username"    # 您的帳號
PASSWORD="your_password"    # 您的密碼（建議使用 Keychain）

# 修改共享資料夾名稱
SHARES=(
    "製造"
    "品保"
    "資訊"
    "採購"
    "其他部門"  # 根據實際情況新增
)
```

### 3. 修改控制腳本設定

編輯 `scripts/kess-control.sh`：

```bash
# 修改 VPN 名稱（必須與系統偏好設定中的名稱一致）
VPN_NAME="公司VPN"
```

### 4. 設定環境變數

編輯 `.env` 檔案：

```bash
# 啟用網路監控
NETWORK_MONITORING=true

# 設定要監控的網路資料夾
WATCH_FOLDERS=/Volumes/製造,/Volumes/品保,/Volumes/資訊,/Volumes/採購

# 網路監控參數調整
NETWORK_RETRY_ATTEMPTS=5
NETWORK_TIMEOUT=30000
POLLING_INTERVAL=10000  # 網路磁碟機建議較長的輪詢間隔
```

## 使用方法

### 完整啟動系統

```bash
cd /path/to/sfda_mcpserver/sfda_kess
./scripts/kess-control.sh start
```

這會依序執行：

1. 連線 VPN
2. 掛載網路磁碟機
3. 啟動 KESS 監控系統

### 完整停止系統

```bash
./scripts/kess-control.sh stop
```

這會依序執行：

1. 停止 KESS 系統
2. 卸載網路磁碟機
3. 斷線 VPN

### 檢查系統狀態

```bash
./scripts/kess-control.sh status
```

### 僅控制 VPN

```bash
# 連線 VPN
./scripts/kess-control.sh vpn-only connect

# 斷線 VPN
./scripts/kess-control.sh vpn-only disconnect

# 檢查 VPN 狀態
./scripts/kess-control.sh vpn-only status
```

### 僅控制網路磁碟機

```bash
# 掛載所有磁碟機
./scripts/mount-network-drives.sh mount

# 卸載所有磁碟機
./scripts/mount-network-drives.sh unmount

# 檢查掛載狀態
./scripts/mount-network-drives.sh status
```

## 常見問題與解決方案

### 1. VPN 連線失敗

**檢查項目：**

- VPN 名稱是否與系統偏好設定中一致
- 網路連線是否正常
- VPN 伺服器是否可達
- 帳號密碼是否正確

**解決方法：**

```bash
# 手動測試 VPN 連線
networksetup -listallnetworkservices
networksetup -showpppoestatus "公司VPN"
```

### 2. 網路磁碟機掛載失敗

**檢查項目：**

- VPN 是否已成功連線
- 伺服器 IP 是否正確
- 共享資料夾名稱是否正確
- 帳號權限是否足夠

**解決方法：**

```bash
# 測試伺服器連線
ping 192.168.1.100

# 手動掛載測試
mount -t smbfs //192.168.1.100/製造 /Volumes/製造
```

### 3. KESS 監控不穩定

**可能原因：**

- 網路延遲較高
- 輪詢間隔太短
- 檔案鎖定問題

**解決方法：**
調整 `.env` 中的參數：

```bash
POLLING_INTERVAL=15000      # 增加輪詢間隔
NETWORK_TIMEOUT=60000       # 增加網路超時時間
NETWORK_RETRY_ATTEMPTS=10   # 增加重試次數
```

### 4. 權限問題

**確保以下權限：**

```bash
# 腳本執行權限
chmod +x scripts/*.sh

# 掛載點權限
sudo mkdir -p /Volumes/製造
sudo chown $(whoami) /Volumes/製造
```

## 安全建議

### 1. 使用 Keychain 儲存密碼

不要在腳本中明文儲存密碼，使用 macOS Keychain：

```bash
# 儲存密碼到 Keychain
security add-generic-password -s "company_smb" -a "your_username" -w "your_password"

# 在腳本中讀取密碼
PASSWORD=$(security find-generic-password -s "company_smb" -a "your_username" -w)
```

### 2. 設定檔案權限

```bash
# 保護設定檔
chmod 600 .env
chmod 600 scripts/*.sh
```

### 3. 定期檢查連線

建議設定 cron 工作定期檢查連線狀態：

```bash
# 編輯 crontab
crontab -e

# 新增每小時檢查一次
0 * * * * /path/to/kess/scripts/kess-control.sh status >> /path/to/kess/logs/status.log 2>&1
```

## 監控與日誌

### 日誌檔案位置

- KESS 系統日誌：`logs/kess.log`
- VPN 連線日誌：系統日誌
- 掛載操作日誌：控制台輸出

### 監控指標

系統會記錄以下指標：

- VPN 連線狀態
- 網路磁碟機掛載狀態
- 檔案處理成功/失敗數量
- 網路重試次數
- 處理延遲時間

## 效能優化

### 網路磁碟機監控最佳實務

1. **輪詢間隔調整**：根據網路狀況調整 `POLLING_INTERVAL`
2. **批次處理**：設定適當的 `BATCH_SIZE`
3. **檔案大小限制**：設定 `MAX_FILE_SIZE` 避免處理過大檔案
4. **忽略模式**：正確設定 `ignorePatterns` 避免不必要的監控

### 系統資源管理

```bash
# 監控系統資源使用情況
top -pid $(pgrep -f "node.*kess")

# 監控網路使用情況
netstat -i
```

這個設定讓您可以透過 VPN 安全地監控公司網路磁碟機中的檔案，KESS 系統會自動處理網路斷線、重連等情況，確保穩定的檔案監控服務。
