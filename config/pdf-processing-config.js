/**
 * KESS 增強版 PDF 處理設定
 * 可根據需求調整 PDF 處理參數
 */

module.exports = {
  // OCR 設定
  ocr: {
    // 支援的語言（按優先順序）
    languages: [
      "chi_tra", // 繁體中文
      "chi_sim", // 簡體中文
      "eng", // 英文
    ],

    // Tesseract 引擎模式
    engineMode: 1, // LSTM OCR Engine (較新較準確)

    // 頁面分割模式
    pageSegmentationMode: 3, // 完全自動頁面分割

    // OCR 觸發條件
    triggers: {
      // 當文字長度少於此值時觸發 OCR
      minTextLength: 50,

      // 當特殊字符比例超過此值時觸發 OCR
      maxSpecialCharRatio: 0.3,

      // 強制 OCR（忽略文字提取結果）
      forceOcr: false,
    },
  },

  // PDF 處理限制
  limits: {
    // 最大處理頁數
    maxPages: 100,

    // 最大檔案大小 (MB)
    maxFileSizeMB: 50,

    // 處理超時時間 (秒)
    timeoutSeconds: 300,
  },

  // 文字處理設定
  textProcessing: {
    // 標準化空白字符
    normalizeWhitespace: true,

    // 移除過多空行
    removeExcessiveLineBreaks: true,

    // 最小內容長度
    minContentLength: 10,
  },

  // 結構化分析設定
  structureAnalysis: {
    // 是否提取可能的標題
    extractTitles: true,

    // 標題最大長度
    maxTitleLength: 100,

    // 標題最小長度
    minTitleLength: 5,

    // 最多提取標題數量
    maxTitles: 5,

    // 閱讀速度（字/分鐘）用於估算閱讀時間
    readingSpeedWPM: 200,
  },

  // 效能設定
  performance: {
    // 是否啟用詳細日誌
    enableVerboseLogging: true,

    // 是否快取處理結果
    enableCaching: false,

    // 記憶體使用限制
    memoryLimitMB: 512,
  },

  // 錯誤處理
  errorHandling: {
    // 是否在 OCR 失敗時降級到基本處理
    fallbackToBasic: true,

    // 最大重試次數
    maxRetries: 2,

    // 是否記錄處理錯誤
    logErrors: true,
  },

  // 開發與除錯
  debug: {
    // 是否啟用除錯模式
    enabled: false,

    // 是否保存中間處理檔案
    saveIntermediateFiles: false,

    // 除錯輸出目錄
    outputDir: "./debug_output",
  },
};
