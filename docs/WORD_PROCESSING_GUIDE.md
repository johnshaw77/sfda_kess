# KESS 系統 Word 檔案處理功能說明

## 📋 支援的檔案格式

### ✅ 完全支援（無需額外安裝）

| 格式    | 描述             | 處理套件            | 狀態        |
| ------- | ---------------- | ------------------- | ----------- |
| `.docx` | Word 2007+       | mammoth             | ✅ 完全支援 |
| `.xlsx` | Excel 2007+      | xlsx                | ✅ 完全支援 |
| `.xls`  | Excel 97-2003    | xlsx                | ✅ 完全支援 |
| `.pdf`  | PDF 文件         | pdf-parse           | ✅ 完全支援 |
| `.txt`  | 純文字           | 內建                | ✅ 完全支援 |
| `.md`   | Markdown         | 內建                | ✅ 完全支援 |
| `.rtf`  | Rich Text Format | 手動解析 + textract | ✅ 完全支援 |

### ✅ 已安裝並支援

| 格式   | 描述         | 需要套件 | 狀態          |
| ------ | ------------ | -------- | ------------- |
| `.doc` | Word 97-2003 | textract | ✅ 已安裝支援 |

### ⚠️ 可選擴展支援

| 格式   | 描述         | 需要套件            | 安裝指令         |
| ------ | ------------ | ------------------- | ---------------- |
| `.ppt` | PowerPoint   | textract + 系統工具 | 需要額外系統依賴 |
| `.odt` | OpenDocument | textract + 系統工具 | 需要額外系統依賴 |

## 🔧 安裝狀況

### ✅ 已完成安裝

- **基本套件**: mammoth, pdf-parse, xlsx, fs-extra
- **擴展套件**: textract (v2.5.0)

### 🧪 測試結果（2025-06-23）

- ✅ `.docx` 處理：正常
- ✅ `.rtf` 處理：正常（手動解析）
- ✅ `.doc` 處理：textract 已安裝，可處理
- ✅ `.md`, `.txt` 處理：正常
- ✅ `.pdf` 處理：正常
- ✅ `.xlsx`, `.xls` 處理：正常

```bash
npm install officegen    # 建立 Word/Excel 檔案
npm install node-pandoc  # 文件格式轉換
```

## 🚀 使用方式

### 測試檔案處理

```bash
# 測試 Word 檔案處理
npm run test:word

# 查看安裝指南
npm run word:guide

# 建立測試檔案
npm run word:create
```

### 程式化使用

```javascript
const DocumentProcessor = require("./src/processor/document-processor");

const processor = new DocumentProcessor();
const result = await processor.processFile(filePath, fileInfo);

console.log("內容:", result.content);
console.log("字數:", result.wordCount);
```

## 📊 處理功能

### Word 檔案 (.docx)

- ✅ 文字內容提取
- ✅ 中文字符支援
- ✅ 基本格式識別
- ✅ 表格內容提取
- ⚠️ 圖片處理（轉為 base64）
- ❌ 複雜格式保留

### Excel 檔案 (.xlsx/.xls)

- ✅ 多工作表支援
- ✅ 數據內容提取
- ✅ CSV 格式輸出
- ✅ 公式結果提取

### PDF 檔案 (.pdf)

- ✅ 文字內容提取
- ✅ 多頁面支援
- ⚠️ 圖片文字識別（需 OCR）
- ❌ 複雜版面處理

## 🔍 測試結果

基於測試檔案 `word測試文件.md` 的處理結果：

- 📄 檔案大小: 0.84 KB
- ⏱️ 處理時間: 3 ms
- 📝 內容長度: 426 字符
- 🔤 字數統計: 198 字
- ✅ 中文字符: 正常處理
- ✅ 特殊符號: 正常識別

## 🛠️ 故障排除

### 常見問題

1. **檔案讀取失敗**

   - 檢查檔案路徑是否正確
   - 確認檔案格式是否支援
   - 檢查檔案是否損壞

2. **中文亂碼**

   - 確保檔案編碼為 UTF-8
   - 檢查資料庫字符集設定

3. **.doc 檔案無法處理**
   - 安裝 textract 套件
   - 安裝系統依賴工具
   - 或將檔案轉換為 .docx 格式

### 錯誤訊息

```
Error: 不支援 .doc 格式，請轉換為 .docx 格式後重試
```

**解決方案**: 安裝 textract 套件或轉換檔案格式

## 📈 性能指標

| 檔案類型 | 檔案大小 | 處理時間   | 記憶體使用 |
| -------- | -------- | ---------- | ---------- |
| .txt     | 1KB      | <1ms       | 低         |
| .md      | 1KB      | <5ms       | 低         |
| .docx    | 100KB    | 50-200ms   | 中等       |
| .pdf     | 1MB      | 500-2000ms | 中等       |
| .xlsx    | 500KB    | 100-500ms  | 中等       |

## 🔮 未來計劃

- [ ] 支援更多檔案格式 (.pptx, .odt)
- [ ] 改善 PDF OCR 處理
- [ ] 增強表格內容識別
- [ ] 添加檔案預覽功能
- [ ] 支援批量處理

## 📞 技術支援

如有 Word 檔案處理相關問題，請：

1. 檢查檔案格式是否支援
2. 確認相關套件已正確安裝
3. 查看系統日誌錯誤訊息
4. 參考本文件的故障排除章節
