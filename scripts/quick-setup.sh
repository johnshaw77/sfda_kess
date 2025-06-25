#!/bin/bash

# KESS 網路磁碟機快速設定腳本

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 檢查必要工具
check_requirements() {
    log_step "檢查系統需求..."
    
    # 檢查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安裝，請先安裝 Node.js"
        return 1
    fi
    
    # 檢查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安裝，請先安裝 npm"
        return 1
    fi
    
    log_info "✓ Node.js $(node --version)"
    log_info "✓ npm $(npm --version)"
    
    return 0
}

# 設定環境變數檔案
setup_env_file() {
    log_step "設定環境變數檔案..."
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        log_info "已建立 .env 檔案"
    else
        log_warn ".env 檔案已存在，跳過複製"
    fi
    
    echo ""
    echo "請根據以下資訊編輯 .env 檔案："
    echo ""
    echo "=== 重要設定項目 ==="
    echo "1. 資料庫連線："
    echo "   DB_HOST=localhost"
    echo "   DB_NAME=sfda_nexus"
    echo "   DB_USER=root"
    echo "   DB_PASSWORD=your_password"
    echo ""
    echo "2. 本地 LLM："
    echo "   LOCAL_LLM_URL=http://localhost:11434"
    echo "   LOCAL_LLM_MODEL=gemma2:27b"
    echo ""
    echo "3. 網路監控："
    echo "   NETWORK_MONITORING=true"
    echo "   WATCH_FOLDERS=/Volumes/製造,/Volumes/品保,/Volumes/資訊"
    echo ""
    
    read -p "按 Enter 繼續，或按 Ctrl+C 中止以先編輯 .env 檔案..."
}

# VPN 設定指引
setup_vpn_guide() {
    log_step "VPN 設定指引..."
    
    echo ""
    echo "=== VPN 設定步驟 ==="
    echo "1. 開啟「系統偏好設定」→「網路」"
    echo "2. 點擊左下角的「+」按鈕"
    echo "3. 介面選擇「VPN」"
    echo "4. VPN 類型選擇（請詢問IT部門）："
    echo "   - IKEv2（推薦）"
    echo "   - L2TP over IPSec"
    echo "5. 輸入連線資訊（請詢問IT部門）"
    echo "6. 測試連線是否成功"
    echo ""
    
    read -p "請輸入 VPN 連線名稱（必須與系統偏好設定中完全一致）: " vpn_name
    
    if [ -n "$vpn_name" ]; then
        # 更新控制腳本中的 VPN 名稱
        sed -i '' "s/VPN_NAME=\"公司VPN\"/VPN_NAME=\"$vpn_name\"/g" scripts/kess-control.sh
        log_info "已更新控制腳本中的 VPN 名稱"
    fi
}

# 網路磁碟機設定
setup_network_drives() {
    log_step "網路磁碟機設定..."
    
    echo ""
    echo "=== 網路磁碟機設定 ==="
    
    read -p "請輸入檔案伺服器 IP 位址: " server_ip
    read -p "請輸入網路磁碟機使用者名稱: " username
    
    if [ -n "$server_ip" ]; then
        sed -i '' "s/SERVER_IP=\"192.168.1.100\"/SERVER_IP=\"$server_ip\"/g" scripts/mount-network-drives.sh
        log_info "已更新伺服器 IP"
    fi
    
    if [ -n "$username" ]; then
        sed -i '' "s/USERNAME=\"\"/USERNAME=\"$username\"/g" scripts/mount-network-drives.sh
        log_info "已更新使用者名稱"
    fi
    
    echo ""
    echo "現在設定共享資料夾名稱..."
    echo "請輸入要監控的共享資料夾名稱（一行一個，輸入空行結束）："
    
    local shares=()
    while true; do
        read -p "共享資料夾名稱: " share_name
        if [ -z "$share_name" ]; then
            break
        fi
        shares+=("\"$share_name\"")
    done
    
    if [ ${#shares[@]} -gt 0 ]; then
        local shares_string=$(IFS=','; echo "${shares[*]}")
        local shares_array="(\n    ${shares_string//,/$'\n    '}\n)"
        
        # 使用 awk 來替換陣列
        awk -v new_shares="$shares_array" '
        /^SHARES=\(/ {
            print "SHARES=" new_shares
            # 跳過原本的陣列內容
            while (getline && $0 !~ /^\)/) continue
            next
        }
        { print }
        ' scripts/mount-network-drives.sh > scripts/mount-network-drives.sh.tmp
        
        mv scripts/mount-network-drives.sh.tmp scripts/mount-network-drives.sh
        chmod +x scripts/mount-network-drives.sh
        
        log_info "已更新共享資料夾清單"
    fi
    
    # 設定密碼（建議使用 Keychain）
    echo ""
    echo "=== 密碼設定 ==="
    echo "建議使用 Keychain 安全地儲存密碼"
    read -p "是否要設定 Keychain 密碼？ (y/n): " setup_keychain
    
    if [ "$setup_keychain" = "y" ] || [ "$setup_keychain" = "Y" ]; then
        ./scripts/keychain-manager.sh setup
    fi
}

# 安裝相依套件
install_dependencies() {
    log_step "安裝相依套件..."
    
    if [ ! -d "node_modules" ]; then
        log_info "正在安裝 Node.js 相依套件..."
        npm install
        
        if [ $? -eq 0 ]; then
            log_info "✓ 相依套件安裝完成"
        else
            log_error "相依套件安裝失敗"
            return 1
        fi
    else
        log_info "相依套件已安裝，跳過"
    fi
}

# 建立必要目錄
create_directories() {
    log_step "建立必要目錄..."
    
    local dirs=("logs" "demo-data")
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "已建立目錄: $dir"
        fi
    done
}

# 測試資料庫連線
test_database() {
    log_step "測試資料庫連線..."
    
    if command -v mysql &> /dev/null; then
        read -p "是否要測試資料庫連線？ (y/n): " test_db
        
        if [ "$test_db" = "y" ] || [ "$test_db" = "Y" ]; then
            log_info "請輸入資料庫連線資訊："
            read -p "主機 (預設: localhost): " db_host
            read -p "連接埠 (預設: 3306): " db_port
            read -p "資料庫名稱 (預設: sfda_nexus): " db_name
            read -p "使用者名稱 (預設: root): " db_user
            read -s -p "密碼: " db_password
            echo ""
            
            # 使用預設值
            db_host=${db_host:-localhost}
            db_port=${db_port:-3306}
            db_name=${db_name:-sfda_nexus}
            db_user=${db_user:-root}
            
            # 測試連線
            mysql -h "$db_host" -P "$db_port" -u "$db_user" -p"$db_password" -e "USE $db_name; SHOW TABLES;" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                log_info "✓ 資料庫連線成功"
            else
                log_warn "資料庫連線失敗，請檢查設定"
            fi
        fi
    else
        log_warn "mysql 命令未找到，跳過資料庫測試"
    fi
}

# 建立啟動腳本
create_start_script() {
    log_step "建立快速啟動腳本..."
    
    cat > start-kess.sh << 'EOF'
#!/bin/bash

# KESS 快速啟動腳本

cd "$(dirname "$0")"

echo "正在啟動 KESS 系統..."
echo ""

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo "錯誤：.env 檔案不存在"
    echo "請先執行 ./scripts/quick-setup.sh 進行設定"
    exit 1
fi

# 啟動系統
./scripts/kess-control.sh start

EOF
    
    chmod +x start-kess.sh
    log_info "已建立快速啟動腳本: start-kess.sh"
}

# 顯示完成訊息
show_completion_message() {
    echo ""
    echo "=============================================="
    log_info "KESS 快速設定完成！"
    echo "=============================================="
    echo ""
    echo "下一步："
    echo ""
    echo "1. 確認 VPN 連線設定："
    echo "   - 開啟系統偏好設定 → 網路"
    echo "   - 測試 VPN 連線是否正常"
    echo ""
    echo "2. 啟動系統："
    echo "   ./start-kess.sh"
    echo ""
    echo "   或分別啟動："
    echo "   ./scripts/kess-control.sh start"
    echo ""
    echo "3. 檢查系統狀態："
    echo "   ./scripts/kess-control.sh status"
    echo ""
    echo "4. 查看日誌："
    echo "   tail -f logs/kess.log"
    echo ""
    echo "常用命令："
    echo "  啟動: ./scripts/kess-control.sh start"
    echo "  停止: ./scripts/kess-control.sh stop"
    echo "  狀態: ./scripts/kess-control.sh status"
    echo "  重啟: ./scripts/kess-control.sh restart"
    echo ""
    echo "如有問題，請參考："
    echo "  - docs/NETWORK_DRIVE_SETUP.md"
    echo "  - README.md"
    echo ""
}

# 主要執行流程
main() {
    echo "=============================================="
    echo "    KESS 網路磁碟機監控系統快速設定"
    echo "=============================================="
    echo ""
    
    # 檢查當前目錄
    if [ ! -f "package.json" ] || [ ! -d "scripts" ]; then
        log_error "請在 KESS 專案根目錄下執行此腳本"
        exit 1
    fi
    
    # 執行設定步驟
    check_requirements || exit 1
    setup_env_file
    setup_vpn_guide
    setup_network_drives
    install_dependencies || exit 1
    create_directories
    test_database
    create_start_script
    show_completion_message
}

# 執行主函式
main "$@"
