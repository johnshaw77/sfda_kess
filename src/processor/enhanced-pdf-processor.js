const fs = require("fs-extra");
const path = require("path");
const pdfParse = require("pdf-parse");
const tesseract = require("node-tesseract-ocr");
const logger = require("../utils/logger");
const pdfConfig = require("../../config/pdf-processing-config");

/**
 * 增強版 PDF 處理器
 * 支援：
 * 1. 純文字 PDF 提取
 * 2. 圖片型 PDF OCR 識別
 * 3. 結構化資訊提取
 * 4. 中文優化處理
 */
class EnhancedPdfProcessor {
  constructor() {
    // 從設定檔載入設定
    this.config = pdfConfig;

    this.ocrConfig = {
      lang: this.config.ocr.languages.join("+"),
      oem: this.config.ocr.engineMode,
      psm: this.config.ocr.pageSegmentationMode,
    };

    // PDF 處理選項
    this.pdfOptions = {
      max: this.config.limits.maxPages,
      textOptions: {
        normalizeWhitespace: this.config.textProcessing.normalizeWhitespace,
        disableCombineTextItems: false,
      },
    };

    logger.info("增強版 PDF 處理器初始化完成", {
      支援語言: this.config.ocr.languages,
      最大頁數: this.config.limits.maxPages,
      OCR引擎: this.config.ocr.engineMode,
    });
  }

  /**
   * 處理 PDF 檔案（主要入口）
   * @param {string} filePath - PDF 檔案路徑
   * @returns {Object} 處理結果
   */
  async processPdf(filePath) {
    try {
      logger.info(`開始處理 PDF 檔案: ${filePath}`);

      const result = {
        filePath,
        fileName: path.basename(filePath),
        processedAt: new Date(),
        content: "",
        metadata: {},
        processing: {
          textExtraction: false,
          ocrRequired: false,
          ocrPerformed: false,
          pages: 0,
          errors: [],
        },
      };

      // 1. 嘗試直接提取文字
      const textResult = await this.extractTextFromPdf(filePath);
      result.content = textResult.text;
      result.metadata = textResult.metadata;
      result.processing.textExtraction = textResult.success;
      result.processing.pages = textResult.pages;

      // 2. 檢查是否需要 OCR
      if (this.shouldPerformOcr(result.content)) {
        logger.info(`PDF 文字內容不足，啟動 OCR 處理: ${filePath}`);
        result.processing.ocrRequired = true;

        const ocrResult = await this.performOcrOnPdf(filePath);
        if (ocrResult.success) {
          result.content = this.combineTextAndOcr(
            result.content,
            ocrResult.text
          );
          result.processing.ocrPerformed = true;
        } else {
          result.processing.errors.push("OCR 處理失敗: " + ocrResult.error);
        }
      }

      // 3. 後處理文字內容
      result.content = this.postProcessText(result.content);

      // 4. 提取結構化資訊
      result.structure = this.extractStructure(result.content);

      logger.info(`PDF 處理完成: ${filePath}`, {
        contentLength: result.content.length,
        pages: result.processing.pages,
        ocrPerformed: result.processing.ocrPerformed,
      });

      return result;
    } catch (error) {
      logger.logError(`PDF 處理失敗: ${filePath}`, error);
      throw new Error(`PDF 處理失敗: ${error.message}`);
    }
  }

  /**
   * 從 PDF 提取文字
   * @param {string} filePath - PDF 檔案路徑
   * @returns {Object} 提取結果
   */
  async extractTextFromPdf(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(fileBuffer, this.pdfOptions.textOptions);

      return {
        success: true,
        text: pdfData.text || "",
        pages: pdfData.numpages || 0,
        metadata: {
          info: pdfData.info || {},
          metadata: pdfData.metadata || null,
          version: pdfData.version || null,
        },
      };
    } catch (error) {
      logger.logError("PDF 文字提取失敗", error);
      return {
        success: false,
        text: "",
        pages: 0,
        metadata: {},
        error: error.message,
      };
    }
  }
  /**
   * 判斷是否需要執行 OCR
   * @param {string} text - 提取的文字
   * @returns {boolean} 是否需要 OCR
   */
  shouldPerformOcr(text) {
    // 強制 OCR 模式
    if (this.config.ocr.triggers.forceOcr) {
      return true;
    }

    if (!text || text.trim().length === 0) {
      return true; // 沒有文字，需要 OCR
    }

    // 檢查文字長度
    const meaningfulText = text.replace(/\s+/g, " ").trim();
    if (meaningfulText.length < this.config.ocr.triggers.minTextLength) {
      logger.info(
        `文字內容過少 (${meaningfulText.length} < ${this.config.ocr.triggers.minTextLength})，啟用 OCR`
      );
      return true;
    }

    // 檢查特殊字符比例
    const specialChars = (
      text.match(
        /[^\u4e00-\u9fff\u3400-\u4dbf\w\s\.\,\!\?\;\:\-\(\)\[\]\{\}]/g
      ) || []
    ).length;
    const ratio = specialChars / text.length;
    if (ratio > this.config.ocr.triggers.maxSpecialCharRatio) {
      logger.info(`特殊字符比例過高 (${(ratio * 100).toFixed(1)}%)，啟用 OCR`);
      return true;
    }

    return false;
  }

  /**
   * 對 PDF 執行 OCR
   * @param {string} filePath - PDF 檔案路徑
   * @returns {Object} OCR 結果
   */
  async performOcrOnPdf(filePath) {
    try {
      // 注意：這裡使用簡化的 OCR 處理
      // 在實際環境中，您可能需要先將 PDF 轉換為圖片
      logger.info("開始 OCR 處理...");

      // 這裡使用 tesseract 直接處理 PDF（如果支援）
      const ocrText = await tesseract.recognize(filePath, this.ocrConfig);

      return {
        success: true,
        text: ocrText || "",
        method: "tesseract-direct",
      };
    } catch (error) {
      logger.logError("OCR 處理失敗", error);
      return {
        success: false,
        text: "",
        error: error.message,
      };
    }
  }

  /**
   * 合併文字提取和 OCR 結果
   * @param {string} extractedText - 直接提取的文字
   * @param {string} ocrText - OCR 識別的文字
   * @returns {string} 合併後的文字
   */
  combineTextAndOcr(extractedText, ocrText) {
    if (!extractedText || extractedText.trim().length === 0) {
      return ocrText;
    }

    if (!ocrText || ocrText.trim().length === 0) {
      return extractedText;
    }

    // 簡單的合併策略：如果提取的文字太少，使用 OCR 結果
    if (
      extractedText.trim().length < 100 &&
      ocrText.trim().length > extractedText.trim().length
    ) {
      return ocrText;
    }

    // 否則使用提取的文字（通常更準確）
    return extractedText;
  }

  /**
   * 後處理文字內容
   * @param {string} text - 原始文字
   * @returns {string} 處理後的文字
   */
  postProcessText(text) {
    if (!text) return "";

    // 1. 標準化空白字符
    let processed = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 2. 移除過多的空行
    processed = processed.replace(/\n{3,}/g, "\n\n");

    // 3. 標準化空格
    processed = processed.replace(/[ \t]+/g, " ");

    // 4. 移除行首行尾空格
    processed = processed
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    // 5. 移除首尾空白
    processed = processed.trim();

    return processed;
  }

  /**
   * 提取文件結構化資訊
   * @param {string} text - 文字內容
   * @returns {Object} 結構化資訊
   */
  extractStructure(text) {
    if (!text) return {};

    const structure = {
      wordCount: this.countWords(text),
      lineCount: text.split("\n").length,
      paragraphCount: text.split("\n\n").length,
      hasChineseContent: /[\u4e00-\u9fff]/.test(text),
      hasEnglishContent: /[a-zA-Z]/.test(text),
      hasNumbers: /\d/.test(text),
      estimatedReadingTime: Math.ceil(this.countWords(text) / 200), // 假設每分鐘閱讀 200 字
    };

    // 嘗試提取標題
    const lines = text.split("\n").filter((line) => line.trim());
    structure.potentialTitles = lines
      .filter((line) => line.length < 100 && line.length > 5)
      .slice(0, 5); // 取前 5 行作為可能的標題

    return structure;
  }

  /**
   * 計算字數
   * @param {string} text - 文字內容
   * @returns {number} 字數
   */
  countWords(text) {
    if (!text) return 0;

    // 中文字符計算
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    // 英文單詞計算
    const englishWords = text
      .replace(/[\u4e00-\u9fff]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    return chineseChars + englishWords;
  }

  /**
   * 獲取 PDF 處理統計
   * @returns {Object} 統計資訊
   */
  getProcessingStats() {
    return {
      supportedLanguages: ["繁體中文", "簡體中文", "英文"],
      features: [
        "文字提取",
        "OCR 識別",
        "結構化分析",
        "中文優化",
        "自動判斷處理方式",
      ],
      limitations: [
        "需要 Tesseract OCR 引擎",
        "大型 PDF 處理時間較長",
        "OCR 準確度取決於圖片品質",
      ],
    };
  }
}

module.exports = EnhancedPdfProcessor;
