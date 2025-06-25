#!/bin/# 設定變數（請依實際情況修改）
SERVER_IP="192.168.1.100"  # 公司檔案伺服器 IP
USERNAME=""               # 您的帳號

# 密碼設定（三種方式選一）
# 方式1: 手動輸入（較安全）
PASSWORD=""

# 方式2: 從 Keychain 讀取（最安全，推薦）
# PASSWORD=$(./keychain-manager.sh get "$USERNAME" 2>/dev/null)

# 方式3: 從環境變數讀取
# PASSWORD="$SMB_PASSWORD"

# macOS 網路磁碟機掛載腳本
# 用於掛載公司 VPN 網路磁碟機

echo "正在掛載網路磁碟機..."

# 設定變數（請依實際情況修改）
SERVER_IP="192.168.1.100"  # 公司檔案伺服器 IP
USERNAME=""               # 您的帳號
PASSWORD=""               # 您的密碼（建議使用 Keychain）

# SMB 共享資料夾
SHARES=(
    "製造"
    "品保" 
    "資訊"
    "採購"
)

# 掛載點目錄
MOUNT_BASE="/Volumes"

# 檢查 VPN 連線狀態
check_vpn_connection() {
    # 檢查能否 ping 到公司伺服器
    if ping -c 1 -W 2000 $SERVER_IP > /dev/null 2>&1; then
        echo "✓ VPN 連線正常，可連接到 $SERVER_IP"
        return 0
    else
        echo "✗ VPN 連線失敗或伺服器無法連接"
        return 1
    fi
}

# 掛載單一共享資料夾
mount_share() {
    local share_name=$1
    local mount_point="$MOUNT_BASE/$share_name"
    
    echo "正在掛載: $share_name"
    
    # 建立掛載點
    if [ ! -d "$mount_point" ]; then
        sudo mkdir -p "$mount_point"
    fi
    
    # 掛載 SMB 共享
    if [ -n "$USERNAME" ]; then
        if [ -n "$PASSWORD" ]; then
            # 使用提供的帳號密碼
            mount -t smbfs "//$USERNAME:$PASSWORD@$SERVER_IP/$share_name" "$mount_point"
        else
            # 嘗試從 Keychain 讀取密碼
            local keychain_password=$(./keychain-manager.sh get "$USERNAME" 2>/dev/null)
            if [ -n "$keychain_password" ]; then
                echo "使用 Keychain 中的密碼..."
                mount -t smbfs "//$USERNAME:$keychain_password@$SERVER_IP/$share_name" "$mount_point"
            else
                # 使用 Keychain 或手動輸入
                echo "請輸入 $USERNAME 的密碼："
                mount -t smbfs "//$USERNAME@$SERVER_IP/$share_name" "$mount_point"
            fi
        fi
    else
        # 匿名或手動輸入
        mount -t smbfs "//$SERVER_IP/$share_name" "$mount_point"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✓ 成功掛載: $mount_point"
    else
        echo "✗ 掛載失敗: $share_name"
    fi
}

# 卸載單一共享資料夾
unmount_share() {
    local share_name=$1
    local mount_point="$MOUNT_BASE/$share_name"
    
    if [ -d "$mount_point" ]; then
        echo "正在卸載: $mount_point"
        umount "$mount_point"
        if [ $? -eq 0 ]; then
            echo "✓ 成功卸載: $mount_point"
        else
            echo "✗ 卸載失敗: $mount_point"
        fi
    fi
}

# 主要執行邏輯
case "$1" in
    "mount")
        if check_vpn_connection; then
            for share in "${SHARES[@]}"; do
                mount_share "$share"
            done
            echo "掛載完成！"
            echo ""
            echo "請更新 KESS .env 檔案中的 WATCH_FOLDERS："
            echo "NETWORK_MONITORING=true"
            for share in "${SHARES[@]}"; do
                echo "WATCH_FOLDERS=/Volumes/$share"
            done
        fi
        ;;
    "unmount")
        for share in "${SHARES[@]}"; do
            unmount_share "$share"
        done
        echo "卸載完成！"
        ;;
    "status")
        echo "檢查掛載狀態："
        for share in "${SHARES[@]}"; do
            mount_point="$MOUNT_BASE/$share"
            if mountpoint -q "$mount_point" 2>/dev/null; then
                echo "✓ $mount_point 已掛載"
            else
                echo "✗ $mount_point 未掛載"
            fi
        done
        ;;
    *)
        echo "用法: $0 {mount|unmount|status}"
        echo ""
        echo "mount   - 掛載所有網路磁碟機"
        echo "unmount - 卸載所有網路磁碟機"
        echo "status  - 檢查掛載狀態"
        echo ""
        echo "使用前請先修改腳本中的伺服器設定："
        echo "- SERVER_IP: 公司檔案伺服器IP"
        echo "- USERNAME: 您的帳號（可選）"
        echo "- PASSWORD: 您的密碼（可選，建議使用 Keychain）"
        echo "- SHARES: 要掛載的共享資料夾名稱"
        exit 1
        ;;
esac
