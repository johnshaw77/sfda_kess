# KESS 增強版 PDF 處理功能

## 📋 功能概述

KESS 系統已升級支援增強版 PDF 處理，提供以下強大功能：

### ✨ 主要功能

1. **智慧文字提取**
   - 優先使用原生 PDF 文字提取
   - 自動偵測是否需要 OCR 處理
   - 支援純文字和圖片型 PDF

2. **多語言 OCR 支援**
   - 繁體中文 (chi_tra)
   - 簡體中文 (chi_sim)
   - 英文 (eng)
   - 使用 Tesseract OCR 引擎

3. **結構化分析**
   - 字數統計（中文字符 + 英文單詞）
   - 段落和行數分析
   - 語言內容偵測
   - 標題提取
   - 閱讀時間估算

4. **智慧處理策略**
   - 降級處理機制
   - 錯誤恢復
   - 效能優化

## 🚀 使用方法

### 1. 基本使用（透過檔案監控）

將 PDF 檔案放入監控資料夾，KESS 會自動處理：

```javascript
// 檔案被偵測到時自動處理
// 無需額外設定，系統自動選擇最佳處理方式
```

### 2. 程式化調用

```javascript
const DocumentProcessor = require('./src/processor/document-processor');

const processor = new DocumentProcessor();

// 基本處理（返回文字內容）
const content = await processor.processPdfFile('path/to/file.pdf');

// 詳細處理（返回完整資訊）
const detailedResult = await processor.processPdfFileDetailed('path/to/file.pdf');
```

### 3. 測試工具

```bash
# 測試增強版 PDF 處理
npm run test:pdf

# 測試基本 PDF 處理
npm run test:pdf:basic
```

## ⚙️ 設定調整

編輯 `config/pdf-processing-config.js` 來調整處理參數：

```javascript
module.exports = {
  ocr: {
    languages: ["chi_tra", "chi_sim", "eng"],
    triggers: {
      minTextLength: 50,        // OCR 觸發的最小文字長度
      maxSpecialCharRatio: 0.3, // 特殊字符比例閾值
      forceOcr: false          // 強制使用 OCR
    }
  },
  limits: {
    maxPages: 100,       // 最大處理頁數
    maxFileSizeMB: 50,   // 最大檔案大小
    timeoutSeconds: 300  // 處理超時時間
  }
};
```

## 📊 處理結果格式

詳細處理會返回以下資訊：

```javascript
{
  filePath: "檔案路徑",
  fileName: "檔案名稱",
  content: "提取的文字內容",
  metadata: {
    info: {}, // PDF 基本資訊
    version: "PDF 版本"
  },
  processing: {
    textExtraction: true,  // 文字提取是否成功
    ocrRequired: false,    // 是否需要 OCR
    ocrPerformed: false,   // 是否執行了 OCR
    pages: 10,            // 頁數
    errors: []            // 處理錯誤
  },
  structure: {
    wordCount: 1500,           // 字數統計
    lineCount: 100,            // 行數
    paragraphCount: 20,        // 段落數
    hasChineseContent: true,   // 是否包含中文
    hasEnglishContent: true,   // 是否包含英文
    hasNumbers: true,          // 是否包含數字
    estimatedReadingTime: 8,   // 預估閱讀時間（分鐘）
    potentialTitles: [...]     // 可能的標題
  }
}
```

## 🔧 系統需求

### 必要套件
- `pdf-parse`: PDF 文字提取
- `node-tesseract-ocr`: OCR 功能
- `pdfjs-dist`: PDF 解析

### OCR 引擎
- 需要安裝 Tesseract OCR
- Windows: 可透過 chocolatey 安裝
  ```bash
  choco install tesseract
  ```
- 或下載預編譯版本

### 語言包
- 繁體中文: `chi_tra.traineddata`
- 簡體中文: `chi_sim.traineddata`
- 英文: `eng.traineddata`

## 🚨 注意事項

1. **OCR 效能**
   - OCR 處理需要較長時間
   - 大型檔案建議調整 `maxPages` 參數

2. **記憶體使用**
   - 處理大型 PDF 會消耗較多記憶體
   - 可調整 `memoryLimitMB` 參數

3. **錯誤處理**
   - 系統會自動降級到基本處理
   - 詳細錯誤資訊記錄在日誌中

4. **檔案格式**
   - 支援標準 PDF 格式
   - 加密 PDF 需要先解密

## 📈 效能建議

### 一般使用
- 小型檔案 (< 10MB): 使用詳細處理
- 大型檔案 (> 10MB): 考慮基本處理

### 批量處理
- 設定合適的 `maxPages` 限制
- 啟用快取機制（如需要）
- 監控記憶體使用量

### OCR 優化
- 確保圖片清晰度足夠
- 調整 OCR 參數適應特定文件類型
- 考慮預處理圖片品質

## 🐛 疑難排解

### 常見問題

1. **OCR 識別率低**
   - 檢查圖片解析度
   - 嘗試不同的 PSM 模式
   - 確認語言包正確安裝

2. **處理速度慢**
   - 減少 `maxPages` 設定
   - 停用不必要的語言包
   - 檢查系統資源使用

3. **記憶體不足**
   - 調整 `memoryLimitMB` 設定
   - 分批處理大型檔案
   - 重啟服務釋放記憶體

### 日誌檢查
```bash
# 檢視處理日誌
tail -f logs/kess.log | grep PDF

# 檢視錯誤日誌
tail -f logs/error.log | grep PDF
```

## 📞 技術支援

如有問題或需要進一步協助，請檢查：
1. 日誌檔案中的詳細錯誤訊息
2. 系統資源使用狀況
3. Tesseract OCR 安裝狀態
4. 語言包完整性

---

*最後更新: ${new Date().toLocaleDateString()}*
