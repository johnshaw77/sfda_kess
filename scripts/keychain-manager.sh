#!/bin/bash

# Keychain 密碼管理腳本
# 用於安全地儲存和讀取網路磁碟機密碼

# 設定
SERVICE_NAME="kess_network_drive"
KEYCHAIN_NAME="login"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 儲存密碼到 Keychain
store_password() {
    local username=$1
    local password=$2
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        log_error "使用方式: store_password <username> <password>"
        return 1
    fi
    
    log_info "儲存密碼到 Keychain..."
    
    # 檢查是否已存在
    if security find-generic-password -s "$SERVICE_NAME" -a "$username" > /dev/null 2>&1; then
        log_warn "密碼已存在，正在更新..."
        security delete-generic-password -s "$SERVICE_NAME" -a "$username"
    fi
    
    # 新增密碼
    security add-generic-password \
        -s "$SERVICE_NAME" \
        -a "$username" \
        -w "$password" \
        -T "/usr/bin/security" \
        -T "/usr/bin/mount_smbfs"
    
    if [ $? -eq 0 ]; then
        log_info "密碼已成功儲存到 Keychain"
    else
        log_error "儲存密碼失敗"
        return 1
    fi
}

# 從 Keychain 讀取密碼
get_password() {
    local username=$1
    
    if [ -z "$username" ]; then
        log_error "使用方式: get_password <username>"
        return 1
    fi
    
    local password=$(security find-generic-password -s "$SERVICE_NAME" -a "$username" -w 2>/dev/null)
    
    if [ $? -eq 0] && [ -n "$password" ]; then
        echo "$password"
        return 0
    else
        log_error "找不到使用者 $username 的密碼"
        return 1
    fi
}

# 刪除密碼
delete_password() {
    local username=$1
    
    if [ -z "$username" ]; then
        log_error "使用方式: delete_password <username>"
        return 1
    fi
    
    log_info "正在刪除 Keychain 中的密碼..."
    
    security delete-generic-password -s "$SERVICE_NAME" -a "$username"
    
    if [ $? -eq 0 ]; then
        log_info "密碼已成功刪除"
    else
        log_error "刪除密碼失敗"
        return 1
    fi
}

# 列出所有儲存的帳號
list_accounts() {
    log_info "查詢 Keychain 中的帳號..."
    
    # 使用 security 命令查詢
    security dump-keychain | grep -A 5 -B 5 "$SERVICE_NAME" | grep "\"acct\"" | cut -d'"' -f4
}

# 測試密碼
test_password() {
    local username=$1
    local server_ip=$2
    local share_name=$3
    
    if [ -z "$username" ] || [ -z "$server_ip" ] || [ -z "$share_name" ]; then
        log_error "使用方式: test_password <username> <server_ip> <share_name>"
        return 1
    fi
    
    log_info "測試密碼是否正確..."
    
    local password=$(get_password "$username")
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    # 建立測試掛載點
    local test_mount="/tmp/kess_test_mount"
    mkdir -p "$test_mount"
    
    # 嘗試掛載
    mount -t smbfs "//$username:$password@$server_ip/$share_name" "$test_mount" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_info "密碼驗證成功！"
        umount "$test_mount"
        rmdir "$test_mount"
        return 0
    else
        log_error "密碼驗證失敗"
        rmdir "$test_mount"
        return 1
    fi
}

# 互動式設定
interactive_setup() {
    log_info "開始互動式密碼設定..."
    echo ""
    
    # 取得使用者輸入
    read -p "請輸入網路磁碟機使用者名稱: " username
    read -s -p "請輸入密碼: " password
    echo ""
    read -p "請輸入伺服器 IP 位址: " server_ip
    read -p "請輸入測試用的共享資料夾名稱: " share_name
    
    # 儲存密碼
    store_password "$username" "$password"
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    # 測試密碼
    if [ -n "$server_ip" ] && [ -n "$share_name" ]; then
        echo ""
        log_info "正在測試密碼..."
        test_password "$username" "$server_ip" "$share_name"
    fi
    
    echo ""
    log_info "設定完成！您現在可以在掛載腳本中使用儲存的密碼。"
    echo ""
    echo "在 mount-network-drives.sh 中，將密碼設定改為："
    echo "PASSWORD=\$(./keychain-manager.sh get \"$username\")"
}

# 主要執行邏輯
case "$1" in
    "store")
        store_password "$2" "$3"
        ;;
    "get")
        get_password "$2"
        ;;
    "delete")
        delete_password "$2"
        ;;
    "list")
        list_accounts
        ;;
    "test")
        test_password "$2" "$3" "$4"
        ;;
    "setup")
        interactive_setup
        ;;
    *)
        echo "KESS Keychain 密碼管理工具"
        echo ""
        echo "用法: $0 {store|get|delete|list|test|setup}"
        echo ""
        echo "命令說明："
        echo "  store <username> <password>              - 儲存密碼到 Keychain"
        echo "  get <username>                          - 讀取密碼（僅輸出到 stdout）"
        echo "  delete <username>                       - 刪除儲存的密碼"
        echo "  list                                    - 列出所有儲存的帳號"
        echo "  test <username> <server_ip> <share>     - 測試密碼是否正確"
        echo "  setup                                   - 互動式設定"
        echo ""
        echo "範例："
        echo "  $0 setup                                # 互動式設定"
        echo "  $0 store john_doe mypassword            # 儲存密碼"
        echo "  $0 get john_doe                         # 讀取密碼"
        echo "  $0 test john_doe 192.168.1.100 製造     # 測試密碼"
        echo ""
        echo "安全注意事項："
        echo "1. 密碼會安全地儲存在 macOS Keychain 中"
        echo "2. 只有目前使用者可以存取這些密碼"
        echo "3. 建議定期更新密碼"
        exit 1
        ;;
esac
