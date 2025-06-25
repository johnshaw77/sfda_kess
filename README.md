# KESS - Knowledge Extraction and Summary System

知識提取與摘要系統，用於監控指定資料夾中的文件，並使用大語言模型進行智能摘要。

## 功能特色

- 🔍 **智能文件監控**: 自動監控指定資料夾的文件變更
- 📄 **多格式支援**: 支援 TXT, MD, PDF, DOCX, XLSX 等多種文件格式
- 🤖 **LLM 整合**: 整合多種大語言模型進行智能摘要
- 📊 **資料庫儲存**: 使用 MySQL 儲存文件記錄與摘要結果
- ⚡ **任務排程**: 支援 cron 任務排程，定期處理文件
- 📝 **日誌追蹤**: 完整的操作日誌與錯誤追蹤

## 安裝與設定

### 1. 安裝依賴套件

```bash
npm install
```

### 2. 環境設定

複製 `.env.example` 為 `.env` 並設定相關參數：

```bash
cp .env.example .env
```

### 3. 資料庫初始化

```bash
npm run migrate
```

### 4. 執行系統

```bash
# 開發模式
npm run dev

# 正式環境
npm start
```

## 設定檔案

### 環境變數 (.env)

```
# 資料庫設定（使用與 sfda_nexus 相同的資料庫）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sfda_nexus
DB_USER=your_username
DB_PASSWORD=your_password

# LLM 設定（使用本機 Gemma 3:27b）
LLM_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=gemma2:27b

# 監控設定
WATCH_FOLDERS=/path/to/watch1,/path/to/watch2
POLLING_INTERVAL=5000
MAX_FILE_SIZE=10485760

# 日誌設定
LOG_LEVEL=info
LOG_FILE=./logs/kess.log
```

## 系統架構

```
src/
├── index.js              # 主程式入口
├── scheduler/            # 任務排程器
├── monitor/              # 文件監控模組
├── processor/            # 文件處理模組
├── llm/                  # LLM 整合模組
├── database/             # 資料庫操作
├── utils/                # 工具函數
└── services/             # 業務邏輯服務
```

## 使用方式

1. **設定監控資料夾**: 在 `.env` 中設定 `WATCH_FOLDERS`
2. **啟動系統**: 執行 `npm start`
3. **查看結果**: 摘要結果會自動儲存到資料庫中

## 資料庫表格

所有表格使用 `kess_` 前綴以區分其他系統：

- `kess_documents`: 文件記錄表
- `kess_summaries`: 摘要結果表
- `kess_processing_logs`: 處理日誌表
- `kess_watched_folders`: 監控資料夾設定表
- `kess_system_settings`: 系統設定表

## 開發指南

### 新增文件格式支援

1. 在 `src/processor/content-extractor.js` 中新增對應的解析函數
2. 更新 `src/processor/file-validator.js` 中的檔案類型驗證

### 新增 LLM 提供者

1. 在 `src/llm/llm-client.js` 中新增對應的 API 整合
2. 更新設定檔案以支援新的提供者

 下一步建議
Linux/macOS 支援 - 實作 CIFS 掛載監控（如需要）
設定介面 - 建立 Web 介面管理網路路徑
監控報表 - 新增網路磁碟狀態監控與報表
自動重連 - 實作網路斷線自動重新掛載機制 
## 測試

```bash
npm test
```

## 授權

MIT License
