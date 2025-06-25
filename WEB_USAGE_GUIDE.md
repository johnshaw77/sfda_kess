# KESS Web 介面使用說明

## 系統概述

KESS (Knowledge Extraction and Summary System) Web 介面是一個簡潔、美觀的文件管理和摘要查看系統。透過此介面，您可以：

- 查看系統儀表板統計資訊
- 瀏覽和搜尋處理過的文件
- 查看文件詳細內容
- 閱讀 AI 生成的智能摘要

## 功能說明

### 1. 儀表板 (Dashboard)

- **路徑**: http://localhost:3000/dashboard
- **功能**:
  - 顯示系統總覽統計（總文件數、處理狀態統計等）
  - 最近處理的文件列表
  - 分類統計圖表

### 2. 文件列表 (Documents)

- **路徑**: http://localhost:3000/documents
- **功能**:
  - 分頁顯示所有文件
  - 搜尋文件（按檔名或內容）
  - 按狀態和分類篩選
  - 快速查看文件詳情
  - 顯示處理狀態和時間

### 3. 文件詳情 (Document Detail)

- **路徑**: http://localhost:3000/documents/{id}
- **功能**:
  - 顯示完整文件內容預覽
  - 文件基本資訊（大小、類型、分類等）
  - 處理時間資訊
  - 檔案路徑和雜湊值
  - 操作按鈕（複製、下載、重新處理）

### 4. 摘要詳情 (Summary)

- **路徑**: http://localhost:3000/summaries/{document_id}
- **功能**:
  - 顯示 AI 生成的智能摘要
  - 關鍵字和實體識別結果
  - 摘要統計資訊（長度、置信度等）
  - 處理時間和模型資訊
  - 操作功能（複製、匯出、重新生成）

## 啟動方式

### 開發模式
```bash
npm run dev:web
```

### 生產模式
```bash
npm run start:web
```

伺服器將在 http://localhost:3000 啟動

## 系統需求

- Node.js 16+
- MySQL 資料庫
- 支援的瀏覽器：Chrome, Firefox, Safari, Edge

## 環境設定

確保 `.env` 檔案中包含以下設定：

```env
# 資料庫設定
DB_HOST=10.1.10.131
DB_PORT=3306
DB_NAME=qsm
DB_USER=qsuser
DB_PASSWORD=1q2w3e4R

# Web 伺服器埠號（可選，預設 3000）
WEB_PORT=3000
```

## 技術特色

### 前端技術
- **Bootstrap 5**: 響應式 UI 框架
- **Bootstrap Icons**: 豐富的圖示庫
- **EJS**: 伺服器端模板引擎
- **原生 JavaScript**: 前端互動功能

### 後端技術
- **Express.js**: Web 應用框架
- **MySQL2**: 資料庫連接
- **Moment.js**: 時間處理
- **Winston**: 日誌系統

### 設計特點
- **響應式設計**: 支援桌面和行動裝置
- **清晰導航**: 麵包屑導航和側邊欄
- **狀態指示**: 處理狀態的視覺化顯示
- **搜尋篩選**: 強大的搜尋和篩選功能
- **操作回饋**: 即時通知和確認對話框

## API 端點

### 文件 API
- `GET /api/documents/:id/preview` - 預覽文件內容
- `GET /api/documents/:id/download` - 下載文件
- `POST /api/documents/:id/reprocess` - 重新處理文件
- `DELETE /api/documents/:id` - 刪除文件

### 摘要 API
- `POST /api/summaries/:id/regenerate` - 重新生成摘要
- `DELETE /api/summaries/:id` - 刪除摘要

## 使用技巧

### 搜尋功能
- 在文件列表頁面使用搜尋框
- 支援檔名和內容搜尋
- 可與篩選條件結合使用

### 篩選功能
- 按處理狀態篩選：全部、已完成、處理中、待處理、失敗
- 按分類篩選：製造、品保、資訊等

### 快捷操作
- 點擊文件名快速查看詳情
- 使用操作按鈕進行複製、下載等
- 摘要頁面支援一鍵匯出

## 故障排除

### 常見問題

1. **無法連接資料庫**
   - 檢查 `.env` 檔案中的資料庫設定
   - 確認資料庫伺服器是否正常運行

2. **頁面顯示錯誤**
   - 檢查伺服器控制台的錯誤訊息
   - 確認資料庫表格是否正確建立

3. **文件下載失敗**
   - 檢查檔案路徑是否存在
   - 確認檔案權限設定

### 日誌檢查
系統日誌位於 `./logs/kess.log`，包含詳細的運行資訊和錯誤訊息。

## 開發和擴展

### 新增頁面
1. 在 `views/` 目錄建立新的 EJS 模板
2. 在 `src/web-server.js` 中新增對應路由
3. 如需要，建立對應的 API 端點

### 自定義樣式
編輯 `public/css/style.css` 檔案來修改視覺樣式。

### 新增功能
在 `public/js/app.js` 中新增 JavaScript 功能。

## 版本資訊

- **版本**: 1.0.0
- **更新日期**: 2025年6月25日
- **開發團隊**: SFDA Team

---

如有任何問題或建議，請聯繫開發團隊。
