# KESS 系統開發總結

## 系統概述

KESS (Knowledge Extraction and Summary System) 是一個基於 Node.js 的智能文件監控與知識提取系統。系統能夠自動監控指定資料夾的文件變更，並使用大語言模型對文件內容進行智能分析和摘要。

## 核心功能

### 1. 文件監控 📁

- **即時監控**: 使用 `chokidar` 監控指定資料夾的文件變更
- **多格式支援**: 支援 TXT, MD, PDF, DOCX, XLSX 等常見文件格式
- **智能過濾**: 自動過濾不需要的文件類型和系統文件
- **批次處理**: 支援批次處理多個文件，提高效率

### 2. 內容提取 📄

- **多格式解析**: 針對不同文件格式使用專門的解析器
- **內容清理**: 自動清理和標準化提取的文件內容
- **雜湊計算**: 使用 SHA-256 避免重複處理相同文件
- **預覽生成**: 自動生成文件內容預覽

### 3. 智能摘要 🤖

- **LLM 整合**: 支援 OpenAI 和本地 LLM（如 Ollama）
- **結構化輸出**: 生成包含摘要、關鍵點、關鍵字、實體識別的結構化結果
- **可信度評估**: 對生成的摘要進行可信度評分
- **多語言支援**: 支援繁體中文和其他語言的摘要生成

### 4. 資料管理 🗄️

- **MySQL 儲存**: 使用 MySQL 資料庫儲存所有處理結果
- **關聯設計**: 完整的資料庫關聯設計，支援複雜查詢
- **日誌追蹤**: 詳細的處理日誌和錯誤追蹤
- **資料匯出**: 支援 JSON 和 CSV 格式的資料匯出

## 系統架構

```
KESS System Architecture
├── 監控層 (Monitor Layer)
│   ├── FileWatcher - 文件系統監控
│   └── DirectoryScanner - 目錄掃描
├── 處理層 (Processing Layer)
│   ├── DocumentProcessor - 文件處理
│   ├── ContentExtractor - 內容提取
│   └── FileValidator - 文件驗證
├── 智能層 (Intelligence Layer)
│   ├── SummaryService - 摘要服務
│   ├── LLMClient - LLM 客戶端
│   └── PromptManager - 提示詞管理
├── 資料層 (Data Layer)
│   ├── DatabaseConnection - 資料庫連線
│   ├── DocumentModel - 文件模型
│   └── SummaryModel - 摘要模型
└── 工具層 (Utility Layer)
    ├── Logger - 日誌系統
    ├── ConfigManager - 設定管理
    └── ErrorHandler - 錯誤處理
```

## 資料庫設計

### 主要表格

1. **documents** - 文件記錄表

   - 儲存文件基本資訊、路徑、雜湊值等
   - 追蹤處理狀態和時間

2. **summaries** - 摘要結果表

   - 儲存 LLM 生成的智能摘要
   - 包含關鍵點、關鍵字、實體識別結果

3. **processing_logs** - 處理日誌表

   - 記錄詳細的處理過程和錯誤資訊
   - 支援系統監控和問題診斷

4. **watched_folders** - 監控資料夾設定表

   - 管理要監控的資料夾清單
   - 支援靈活的監控設定

5. **system_settings** - 系統設定表
   - 儲存系統運行參數
   - 支援動態設定調整

## 主要特性

### 🚀 高效能處理

- **異步處理**: 全面採用 async/await 模式
- **批次處理**: 支援文件批次處理，提高吞吐量
- **佇列管理**: 智能處理佇列，避免系統過載
- **重試機制**: 自動重試失敗的處理任務

### 🔄 可靠性保證

- **事務支援**: 資料庫操作支援事務，確保資料一致性
- **錯誤處理**: 完整的錯誤處理機制
- **日誌追蹤**: 詳細的操作日誌，便於問題排查
- **優雅關閉**: 支援優雅關閉，確保處理中的任務完成

### ⚙️ 靈活設定

- **環境變數**: 支援 .env 檔案設定
- **模組化設計**: 各功能模組獨立，易於維護和擴展
- **LLM 可切換**: 支援多種 LLM 提供者，可靈活切換
- **監控設定**: 靈活的文件監控設定

### 📊 管理工具

- **狀態監控**: 即時查看系統運行狀態
- **統計報告**: 詳細的處理統計和效能分析
- **資料管理**: 支援資料清理、匯出、重置等操作
- **命令列工具**: 完整的命令列管理介面

## 使用指南

### 安裝和設定

```bash
# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 檔案，設定資料庫和 LLM 參數

# 3. 執行系統設置
npm run setup

# 4. 啟動系統
npm start
```

### 常用命令

```bash
# 開發模式
npm run dev

# 查看系統狀態
npm run status

# 查看詳細統計
npm run stats

# 清理舊資料
npm run cleanup

# 資料庫遷移
npm run migrate
```

### 管理工具

```bash
# 系統狀態
node scripts/manage.js status

# 詳細統計
node scripts/manage.js stats

# 清理 30 天前的資料
node scripts/manage.js cleanup 30

# 匯出資料
node scripts/manage.js export json

# 重置資料庫
node scripts/manage.js reset
```

## 擴展性設計

### 新增文件格式支援

1. 在 `DocumentProcessor` 中新增對應的解析函數
2. 更新支援的副檔名清單
3. 測試新格式的處理效果

### 新增 LLM 提供者

1. 在 `SummaryService` 中實作新的 LLM 客戶端類別
2. 更新設定檔案支援新提供者
3. 測試新提供者的摘要品質

### 客製化摘要格式

1. 修改 `buildPrompt` 方法中的提示詞模板
2. 更新 `processSummaryResult` 方法的解析邏輯
3. 調整資料庫結構以支援新欄位

## 監控和維護

### 日誌監控

- 系統日誌位於 `logs/` 目錄下
- 支援不同等級的日誌記錄
- 自動日誌輪替，避免檔案過大

### 效能監控

- 處理時間追蹤
- 記憶體使用監控
- 資料庫連線狀態監控

### 定期維護

- 建議定期清理舊的處理日誌
- 監控資料庫大小和效能
- 更新 LLM 模型以提升摘要品質

## 技術棧總結

- **Runtime**: Node.js 16+
- **資料庫**: MySQL 8.0+
- **文件監控**: chokidar
- **文件處理**: mammoth, pdf-parse, xlsx
- **LLM 整合**: OpenAI API, 本地 LLM
- **日誌系統**: winston
- **任務排程**: node-cron

## 結論

KESS 系統提供了一個完整的文件知識提取解決方案，具備：

✅ **完整功能**: 從文件監控到智能摘要的完整工作流程  
✅ **高可靠性**: 穩定的錯誤處理和資料保護機制  
✅ **易於使用**: 簡單的設定和豐富的管理工具  
✅ **可擴展性**: 模組化設計，易於新增功能  
✅ **高效能**: 優化的處理流程和資料庫設計

系統已準備就緒，可以開始處理您的文件並生成智能摘要！🚀
