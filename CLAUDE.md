# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要開發指令

### 應用程式啟動
```bash
# 啟動主要 KESS 應用程式（文件處理）
npm start                    # 生產環境，使用舊版 OpenSSL
npm run start:normal         # 生產環境，不使用舊版 OpenSSL
npm run start:web           # 僅啟動 Web 介面

# 開發模式，自動重載
npm run dev                 # 開發模式，使用舊版 OpenSSL
npm run dev:normal          # 開發模式，不使用舊版 OpenSSL
npm run dev:web             # 開發模式 Web 介面
```

### 資料庫操作
```bash
npm run migrate             # 執行資料庫遷移
npm run setup               # 初始化系統設定
```

### 系統管理
```bash
npm run manage              # 互動式管理介面
npm run status              # 檢查系統狀態
npm run stats               # 顯示系統統計
npm run cleanup             # 清理舊資料
```

### 歸檔管理
```bash
npm run archive:stats       # 顯示歸檔統計
npm run archive:list        # 列出歸檔檔案
npm run archive:cleanup     # 清理歸檔檔案
```

### 測試與除錯
```bash
npm test                    # 執行 Jest 測試
npm run test:word           # 測試 Word 文件處理
npm run test:doc            # 測試 DOC 檔案處理
npm run test:single         # 測試單一檔案處理
npm run test:network        # 測試跨平台網路連線
npm run test:network:windows # 測試 Windows 特定網路功能
npm run test:pdf            # 測試 PDF 處理
```

### 資料維護
```bash
npm run fix:encoding        # 修復中文編碼問題
npm run fix:charset         # 修復字元集問題
npm run check:chinese       # 檢查中文資料完整性
```

## 系統架構

### 核心應用程式結構
- **主要入口點**: `src/index.js` - 包含 `KessApplication` 類別，協調整個系統
- **Web 介面**: `src/web-server.js` - 用於 Web 儀表板的 Express.js 伺服器
- **配置**: `config/index.js` - 從環境變數載入的中央配置

### 主要元件

#### 文件處理管線
1. **檔案監控**: `src/monitor/file-watcher.js` - 監控資料夾的檔案變更
2. **網路監控**: `src/monitor/windows-network-monitor.js` - 監控 Windows 網路共享
3. **文件處理**: `src/processor/document-processor.js` - 從各種檔案格式提取內容
4. **摘要生成**: `src/services/summary-service.js` - 使用 LLM 生成 AI 摘要

#### 資料層
- **資料庫連線**: `src/database/connection.js` - MySQL 連線池管理
- **遷移**: `src/database/migrations/` - 資料庫架構管理
- **資料表**: 所有資料表使用 `kess_` 前綴（kess_documents、kess_summaries、kess_categories 等）

#### 服務
- **分類服務**: `src/services/category-service.js` - 管理文件分類
- **檔案歸檔服務**: `src/services/file-archive-service.js` - 處理檔案歸檔
- **提示管理器**: `src/services/prompt-manager.js` - 管理 LLM 提示

### 處理流程
1. 監控服務偵測到檔案變更
2. 檔案加入 `KessApplication` 的處理佇列
3. `DocumentProcessor` 根據檔案類型提取內容
4. 文件元資料儲存到資料庫
5. `SummaryService` 使用配置的 LLM 生成 AI 摘要
6. 根據配置選擇性歸檔

### LLM 整合
- 支援本地（Ollama）和 OpenAI API
- 預設：透過 Ollama 使用本地 Gemma 3:27b 模型
- 配置位於 `config.llm` 區段

### 跨平台網路儲存支援
- **Windows**: 使用 `net use` 命令掛載 SMB 共享
- **macOS**: 使用 `mount -t smbfs` 掛載 SMB 共享
- **Linux**: 使用 `mount -t cifs` 掛載 CIFS 共享
- 自動偵測作業系統並選擇適當的掛載方式
- 網路問題的可配置重試機制

## 環境配置

複製 `.env.example` 到 `.env` 並配置：

### 資料庫（必要）
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sfda_nexus
DB_USER=your_username
DB_PASSWORD=your_password
```

### LLM 配置
```env
LLM_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=gemma2:27b
```

### 監控路徑
```env
WATCH_FOLDERS=/path/to/folder1,/path/to/folder2
NETWORK_PATHS=\\\\server\\share1,\\\\server\\share2
ENABLE_NETWORK_MONITORING=true
```

## 開發注意事項

### 檔案處理
- 支援：TXT、MD、PDF、DOCX、XLSX、RTF
- 每種檔案類型使用不同處理器
- 內容提取並保留元資料
- 字元編碼偵測與轉換

### Web 介面
- 使用 Express.js 和 EJS 模板建構
- 基於 Bootstrap 的響應式 UI
- 即時文件狀態與統計
- 檔案預覽與下載功能

### 跨平台考量
- **檔案監控**: 適用於所有平台
- **網路監控**: 支援 Windows、macOS、Linux
  - Windows: 自動使用 `net use` 掛載
  - macOS: 自動使用 `mount -t smbfs` 掛載
  - Linux: 自動使用 `mount -t cifs` 掛載
- **SMB 連線格式**: `smb://domain\\username:password@host/share/path`

### 常見問題
- 中文字元編碼：使用 `fix:encoding` 和 `fix:charset` 指令
- 網路連線：使用 `test:network` 指令測試
- 檔案處理：使用 `test:single` 指令除錯
- 資料庫問題：重新執行 `npm run migrate`

## 測試策略

系統包含完整的測試腳本：
- Jest 單元測試
- 檔案處理整合測試
- 網路連線測試
- 資料庫完整性檢查
- Windows 網路平台特定測試