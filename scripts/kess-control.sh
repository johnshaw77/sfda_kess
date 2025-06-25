#!/bin/bash

# 自動 VPN 連線和網路磁碟機掛載腳本

# VPN 設定（請依實際情況修改）
VPN_NAME="公司VPN"  # 在網路偏好設定中的 VPN 名稱
VPN_TIMEOUT=30      # VPN 連線超時時間（秒）

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 輸出帶顏色的訊息
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查 VPN 連線狀態
check_vpn_status() {
    local status=$(networksetup -showpppoestatus "$VPN_NAME" 2>/dev/null)
    if [ "$status" = "connected" ]; then
        return 0
    else
        return 1
    fi
}

# 連線 VPN
connect_vpn() {
    log_info "正在連線 VPN: $VPN_NAME"
    
    if check_vpn_status; then
        log_info "VPN 已連線"
        return 0
    fi
    
    # 開始連線
    networksetup -connectpppoeservice "$VPN_NAME"
    
    # 等待連線完成
    local count=0
    while [ $count -lt $VPN_TIMEOUT ]; do
        if check_vpn_status; then
            log_info "VPN 連線成功！"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    log_error "VPN 連線超時"
    return 1
}

# 斷線 VPN
disconnect_vpn() {
    log_info "正在斷線 VPN: $VPN_NAME"
    networksetup -disconnectpppoeservice "$VPN_NAME"
    
    if ! check_vpn_status; then
        log_info "VPN 已斷線"
    else
        log_warn "VPN 斷線可能失敗"
    fi
}

# 啟動 KESS 系統
start_kess() {
    log_info "正在啟動 KESS 系統..."
    cd "$(dirname "$0")/.."
    
    # 檢查是否已有 .env 檔案
    if [ ! -f ".env" ]; then
        log_warn ".env 檔案不存在，複製範本檔案"
        cp .env.example .env
        log_warn "請編輯 .env 檔案，設定正確的監控資料夾路徑"
    fi
    
    # 安裝相依套件（如果需要）
    if [ ! -d "node_modules" ]; then
        log_info "安裝 Node.js 相依套件..."
        npm install
    fi
    
    # 啟動 KESS
    log_info "啟動 KESS 監控系統..."
    npm start
}

# 停止 KESS 系統
stop_kess() {
    log_info "正在停止 KESS 系統..."
    
    # 尋找並停止 KESS 程序
    local pids=$(pgrep -f "node.*kess")
    if [ -n "$pids" ]; then
        echo $pids | xargs kill -TERM
        log_info "KESS 系統已停止"
    else
        log_warn "找不到執行中的 KESS 程序"
    fi
}

# 主要執行邏輯
case "$1" in
    "start")
        log_info "開始完整啟動程序..."
        
        # 1. 連線 VPN
        if connect_vpn; then
            # 2. 掛載網路磁碟機
            log_info "等待 2 秒後掛載網路磁碟機..."
            sleep 2
            ./mount-network-drives.sh mount
            
            # 3. 啟動 KESS
            sleep 2
            start_kess
        else
            log_error "VPN 連線失敗，無法繼續"
            exit 1
        fi
        ;;
    
    "stop")
        log_info "開始完整停止程序..."
        
        # 1. 停止 KESS
        stop_kess
        
        # 2. 卸載網路磁碟機
        sleep 2
        ./mount-network-drives.sh unmount
        
        # 3. 斷線 VPN
        sleep 2
        disconnect_vpn
        
        log_info "完整停止程序完成"
        ;;
    
    "status")
        echo "=== 系統狀態檢查 ==="
        echo ""
        
        # VPN 狀態
        if check_vpn_status; then
            log_info "VPN: 已連線"
        else
            log_warn "VPN: 未連線"
        fi
        
        # 網路磁碟機狀態
        echo ""
        ./mount-network-drives.sh status
        
        # KESS 程序狀態
        echo ""
        local pids=$(pgrep -f "node.*kess")
        if [ -n "$pids" ]; then
            log_info "KESS: 執行中 (PID: $pids)"
        else
            log_warn "KESS: 未執行"
        fi
        ;;
    
    "restart")
        log_info "重新啟動系統..."
        $0 stop
        sleep 3
        $0 start
        ;;
    
    "vpn-only")
        case "$2" in
            "connect")
                connect_vpn
                ;;
            "disconnect")
                disconnect_vpn
                ;;
            "status")
                if check_vpn_status; then
                    log_info "VPN: 已連線"
                else
                    log_warn "VPN: 未連線"
                fi
                ;;
            *)
                echo "用法: $0 vpn-only {connect|disconnect|status}"
                ;;
        esac
        ;;
    
    *)
        echo "KESS 網路磁碟機監控系統控制腳本"
        echo ""
        echo "用法: $0 {start|stop|restart|status|vpn-only}"
        echo ""
        echo "命令說明："
        echo "  start       - 連線 VPN、掛載磁碟機、啟動 KESS"
        echo "  stop        - 停止 KESS、卸載磁碟機、斷線 VPN"
        echo "  restart     - 重新啟動整個系統"
        echo "  status      - 檢查 VPN、磁碟機、KESS 狀態"
        echo "  vpn-only    - 僅控制 VPN 連線"
        echo ""
        echo "使用前請先修改腳本中的 VPN 設定："
        echo "- VPN_NAME: 在系統偏好設定中的 VPN 名稱"
        echo ""
        echo "同時請確保："
        echo "1. 已在系統偏好設定中建立 VPN 連線"
        echo "2. 已修改 mount-network-drives.sh 中的伺服器設定"
        echo "3. 已設定 .env 檔案中的監控資料夾"
        exit 1
        ;;
esac
