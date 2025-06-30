const fs = require("fs-extra");
const crypto = require("crypto");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const xlsx = require("xlsx");
const logger = require("../utils/logger");
const fileArchivingService = require("../services/file-archiving-service");
const EnhancedPdfProcessor = require("./enhanced-pdf-processor");
// const pptx2json = require("pptx2json");

class DocumentProcessor {
  constructor() {
    this.supportedExtensions = {
      ".txt": this.processTxtFile.bind(this),
      ".md": this.processTxtFile.bind(this),
      ".pdf": this.processPdfFile.bind(this),
      ".docx": this.processDocxFile.bind(this),
      ".doc": this.processDocFile.bind(this), // 添加 .doc 支援
      ".xlsx": this.processXlsxFile.bind(this),
      ".xls": this.processXlsxFile.bind(this),
      ".rtf": this.processRtfFile.bind(this), // 添加 RTF 支援
      // ".pptx": this.processPptxFile.bind(this), // 暫時停用 pptx 處理
    };

    // 初始化增強版 PDF 處理器
    this.enhancedPdfProcessor = new EnhancedPdfProcessor();
  }

  /**
   * 處理檔案
   * @param {string} filePath - 檔案路徑
   * @param {Object} fileInfo - 檔案資訊
   * @returns {Object} 處理後的文件資料
   */
  async processFile(filePath, fileInfo) {
    try {
      logger.logProcessing("DOC_PROCESS", `開始處理檔案: ${fileInfo.fileName}`);

      // 1. 驗證檔案
      await this.validateFile(filePath, fileInfo);

      // 2. 計算檔案雜湊
      const fileHash = await this.calculateFileHash(filePath);

      // 3. 提取檔案內容
      const content = await this.extractContent(
        filePath,
        fileInfo.fileExtension
      );

      // 4. 建立文件資料
      const documentData = {
        filePath: path.resolve(filePath),
        fileName: fileInfo.fileName,
        fileExtension: fileInfo.fileExtension,
        fileSize: fileInfo.fileSize,
        fileHash: fileHash,
        fileModifiedTime: fileInfo.fileModifiedTime,
        content: content,
        contentPreview: this.createContentPreview(content),
        wordCount: this.countWords(content),
        processedAt: new Date(),
      };

      logger.logProcessing(
        "DOC_COMPLETE",
        `檔案處理完成: ${fileInfo.fileName}`,
        {
          contentLength: content.length,
          wordCount: documentData.wordCount,
        }
      );

      return documentData;
    } catch (error) {
      logger.logError(`檔案處理失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理檔案完整流程（包含歸檔）
   * @param {string} filePath - 檔案路徑
   * @param {Object} fileInfo - 檔案資訊
   * @param {number} documentId - 文件 ID（處理完成後獲得）
   * @returns {Object} 處理結果
   */
  async processFileWithArchiving(filePath, fileInfo, documentId = null) {
    let documentData = null;

    try {
      logger.info(`開始完整處理檔案: ${filePath}`);

      // 1. 處理文件內容
      documentData = await this.processFile(filePath, fileInfo);

      // 2. 如果有 documentId，加入到 documentData 中
      if (documentId) {
        documentData.id = documentId;
      }

      // 3. 處理完成後歸檔檔案
      await this.archiveProcessedFile(filePath, documentData);

      logger.info(`文件完整處理完成: ${filePath}`);
      return documentData;
    } catch (error) {
      logger.logError(`處理文件時發生錯誤: ${filePath}`, error);

      // 即使處理失敗也嘗試建立錯誤記錄
      if (documentData && documentData.id) {
        await this.logProcessingError(documentData.id, error);
      }

      throw error;
    }
  }

  /**
   * 驗證檔案
   * @param {string} filePath - 檔案路徑
   * @param {Object} fileInfo - 檔案資訊
   */
  async validateFile(filePath, fileInfo) {
    // 檢查檔案是否存在
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`檔案不存在: ${filePath}`);
    }

    // 確保 fileExtension 存在，如果不存在則從檔案路徑提取
    if (!fileInfo.fileExtension) {
      const path = require("path");
      fileInfo.fileExtension = path.extname(filePath).toLowerCase();
      logger.logProcessing(
        "DOC_PROCESS",
        `從檔案路徑提取副檔名: ${fileInfo.fileExtension} (檔案: ${filePath})`
      );
    }

    // 如果仍然沒有副檔名，嘗試從檔案名稱中提取
    if (!fileInfo.fileExtension) {
      const path = require("path");
      const fileName = path.basename(filePath);
      if (fileName.includes(".")) {
        const lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex > -1) {
          fileInfo.fileExtension = fileName
            .substring(lastDotIndex)
            .toLowerCase();
          logger.logProcessing(
            "DOC_PROCESS",
            `從檔案名稱提取副檔名: ${fileInfo.fileExtension} (檔案: ${filePath})`
          );
        }
      }
    }

    // 檢查檔案格式是否支援
    if (
      !fileInfo.fileExtension ||
      !this.supportedExtensions[fileInfo.fileExtension]
    ) {
      throw new Error(
        `不支援的檔案格式: ${
          fileInfo.fileExtension || "未知"
        } (檔案: ${path.basename(filePath)})`
      );
    }

    // 檢查檔案大小
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error(`檔案為空: ${filePath}`);
    }
  }

  /**
   * 計算檔案雜湊值
   * @param {string} filePath - 檔案路徑
   * @returns {string} SHA-256 雜湊值
   */
  async calculateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash("sha256").update(fileBuffer).digest("hex");
    } catch (error) {
      logger.logError(`計算檔案雜湊失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 提取檔案內容
   * @param {string} filePath - 檔案路徑
   * @param {string} fileExtension - 檔案副檔名
   * @returns {string} 檔案內容
   */
  async extractContent(filePath, fileExtension) {
    try {
      const processor = this.supportedExtensions[fileExtension];
      if (!processor) {
        throw new Error(`不支援的檔案格式: ${fileExtension}`);
      }

      const content = await processor(filePath);
      return this.cleanContent(content);
    } catch (error) {
      logger.logError(`內容提取失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理文字檔案 (.txt, .md)
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processTxtFile(filePath) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      throw new Error(`讀取文字檔案失敗: ${error.message}`);
    }
  }

  /**
   * 處理 PDF 檔案 - 增強版
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processPdfFile(filePath) {
    try {
      logger.info(`使用增強版 PDF 處理器處理檔案: ${filePath}`);

      // 使用增強版 PDF 處理器
      const result = await this.enhancedPdfProcessor.processPdf(filePath);

      // 記錄處理資訊
      logger.info(`PDF 處理完成: ${filePath}`, {
        pages: result.processing.pages,
        ocrPerformed: result.processing.ocrPerformed,
        contentLength: result.content.length,
        wordCount: result.structure?.wordCount || 0,
      });

      return result.content;
    } catch (error) {
      logger.logError(`增強版 PDF 處理失敗，嘗試基本處理: ${filePath}`, error);

      // 降級到基本處理
      try {
        const fileBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(fileBuffer);
        logger.info(`PDF 基本處理成功: ${filePath}`);
        return pdfData.text;
      } catch (basicError) {
        throw new Error(`PDF 處理完全失敗: ${basicError.message}`);
      }
    }
  }

  /**
   * 處理 PDF 檔案並返回詳細資訊
   * @param {string} filePath - 檔案路徑
   * @returns {Object} 詳細處理結果
   */
  async processPdfFileDetailed(filePath) {
    try {
      return await this.enhancedPdfProcessor.processPdf(filePath);
    } catch (error) {
      logger.logError(`PDF 詳細處理失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理 Word 檔案 (.docx) - 增強版
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processDocxFile(filePath) {
    try {
      logger.info(`開始處理 DOCX 檔案: ${filePath}`);
      const fileBuffer = await fs.readFile(filePath);

      // 使用 mammoth 提取純文字，保留部分格式
      const result = await mammoth.extractRawText({
        buffer: fileBuffer,
        convertImage: mammoth.images.imgElement(function (image) {
          return image.read("base64").then(function (imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer,
            };
          });
        }),
      });

      // 檢查是否有警告訊息
      if (result.messages && result.messages.length > 0) {
        logger.info(
          `DOCX 處理警告: ${result.messages.map((m) => m.message).join(", ")}`
        );
      }

      const content = result.value;

      if (!content || content.trim().length === 0) {
        throw new Error("Word 檔案內容為空或無法讀取");
      }

      logger.info(`DOCX 檔案處理完成，內容長度: ${content.length} 字符`);
      return content;
    } catch (error) {
      logger.logError(`讀取 DOCX 檔案失敗: ${filePath}`, error);
      throw new Error(`讀取 Word 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 處理舊版 Word 檔案 (.doc)
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processDocFile(filePath) {
    try {
      logger.info(`開始處理 DOC 檔案: ${filePath}`);

      // 嘗試使用 textract（如果可用）
      try {
        const textract = require("textract");
        return new Promise((resolve, reject) => {
          textract.fromFileWithPath(
            filePath,
            {
              preserveLineBreaks: true,
              timeout: 30000, // 30秒超時
            },
            (error, text) => {
              if (error) {
                // 檢查是否為 antiword 相關的錯誤
                const errorMsg = error.message || "";
                const isAntiwordError =
                  errorMsg.includes("antiword") &&
                  (errorMsg.includes("not recognized") ||
                    errorMsg.includes("不是內部或外部命令") ||
                    errorMsg.includes("找不到指定的檔案") ||
                    errorMsg.includes("not found") ||
                    errorMsg.includes("command not found") ||
                    errorMsg.includes("Command failed: antiword") ||
                    errorMsg.includes("antiword read of file") ||
                    errorMsg.includes("failed: Error: Command failed"));

                if (isAntiwordError) {
                  logger.warn(
                    `antiword 工具未安裝或執行失敗，無法處理 DOC 檔案: ${path.basename(
                      filePath
                    )}`
                  );
                  resolve(
                    `[系統訊息] 無法處理 DOC 檔案 "${path.basename(
                      filePath
                    )}"，建議轉換為 DOCX 格式。\n檔案路徑: ${filePath}\n處理時間: ${new Date().toLocaleString()}\n錯誤原因: ${errorMsg}\n\n請安裝 antiword 工具或將檔案轉換為 DOCX 格式以支援內容提取。`
                  );
                } else {
                  reject(new Error(`textract 處理失敗: ${error.message}`));
                }
              } else {
                logger.info(
                  `DOC 檔案處理完成，內容長度: ${(text || "").length} 字符`
                );
                resolve(text || "");
              }
            }
          );
        });
      } catch (textractError) {
        logger.info("textract 套件未安裝，嘗試其他方法");
        // 提供降級處理方案
        const fileName = path.basename(filePath);
        const fallbackContent = `[系統訊息] DOC 檔案處理工具未完整安裝，無法提取文字內容\n檔案名稱: ${fileName}\n檔案路徑: ${filePath}\n處理時間: ${new Date().toLocaleString()}\n\n建議解決方案:\n1. 將檔案轉換為 DOCX 格式\n2. 安裝 antiword 工具以支援 DOC 檔案處理`;
        logger.info(`DOC 檔案降級處理完成: ${fileName}`);
        return fallbackContent;
      }
    } catch (error) {
      logger.logError(`讀取 DOC 檔案失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理 RTF 檔案
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processRtfFile(filePath) {
    try {
      logger.info(`開始處理 RTF 檔案: ${filePath}`);

      // 先嘗試使用 textract（如果可用且有效）
      try {
        const textract = require("textract");
        const textractResult = await new Promise((resolve, reject) => {
          textract.fromFileWithPath(
            filePath,
            {
              preserveLineBreaks: true,
              ignoreHiddenText: true,
            },
            (error, text) => {
              if (error) {
                reject(error);
              } else {
                resolve(text || "");
              }
            }
          );
        });

        // 檢查 textract 結果是否有效（不是亂碼）
        if (textractResult && textractResult.length > 0) {
          // 簡單檢測是否為亂碼（包含大量非ASCII字符）
          const chineseRatio =
            (textractResult.match(/[\u4e00-\u9fff]/g) || []).length /
            textractResult.length;
          const asciiRatio =
            (textractResult.match(/[\x20-\x7E]/g) || []).length /
            textractResult.length;

          // 如果包含中文字符或ASCII字符比例合理，且不包含明顯的編碼錯誤字符
          if (
            (chineseRatio > 0.1 || asciiRatio > 0.5) &&
            !textractResult.includes("ï¼š") &&
            !textractResult.includes("â")
          ) {
            logger.info(
              `RTF 檔案處理完成（textract），內容長度: ${textractResult.length} 字符`
            );
            return textractResult;
          } else {
            logger.info("textract 結果包含編碼問題，改用手動解析");
          }
        }
      } catch (textractError) {
        logger.info(
          `textract 處理 RTF 失敗: ${textractError.message}，改用手動解析`
        );
      }

      // 回退到手動解析 RTF
      const content = await fs.readFile(filePath, "utf8");

      // 改進的 RTF 標記清理
      let cleanContent = content
        // 移除 RTF 控制字和參數
        .replace(/\\[a-z]+\d*/gi, " ")
        // 移除大括號
        .replace(/[{}]/g, "")
        // 移除多餘的反斜線
        .replace(/\\\\/g, " ")
        // 清理特殊的 RTF 編碼
        .replace(/\\'/g, "")
        // 合併多個空格和換行
        .replace(/\s+/g, " ")
        .trim();

      logger.info(
        `RTF 檔案處理完成（手動解析），內容長度: ${cleanContent.length} 字符`
      );
      return cleanContent;
    } catch (error) {
      logger.logError(`讀取 RTF 檔案失敗: ${filePath}`, error);
      throw new Error(`讀取 RTF 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 處理 Excel 檔案 (.xlsx, .xls)
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processXlsxFile(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      let content = "";

      // 處理所有工作表
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = xlsx.utils.sheet_to_csv(worksheet);
        content += `=== 工作表: ${sheetName} ===\n${sheetData}\n\n`;
      }

      return content;
    } catch (error) {
      throw new Error(`讀取 Excel 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 處理 PowerPoint 檔案 (.pptx)
   * @param {string} filePath - 檔案路徑
   * @returns {string} 檔案內容
   */
  async processPptxFile(filePath) {
    try {
      logger.info(`開始處理 PPTX 檔案: ${filePath}`);
      // 正確用法：直接呼叫 pptx2json(filePath)
      const result = await pptx2json(filePath);
      if (!result || !result.slides || result.slides.length === 0) {
        throw new Error("PPTX 檔案無法解析或無內容");
      }
      // 將所有投影片文字合併
      const content = result.slides
        .map((slide) => (slide.texts ? slide.texts.join(" ") : ""))
        .join("\n---\n");
      if (!content || content.trim().length === 0) {
        throw new Error("PPTX 檔案內容為空或無法讀取");
      }
      logger.info(`PPTX 檔案處理完成，內容長度: ${content.length} 字符`);
      return content;
    } catch (error) {
      logger.logError(`讀取 PPTX 檔案失敗: ${filePath}`, error);
      throw new Error(`讀取 PPTX 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 清理內容
   * @param {string} content - 原始內容
   * @returns {string} 清理後的內容
   */
  cleanContent(content) {
    if (!content) return "";

    return (
      content
        // 移除多餘的空白字元
        .replace(/\s+/g, " ")
        // 移除多餘的換行
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        // 移除開頭和結尾的空白
        .trim()
    );
  }

  /**
   * 建立內容預覽
   * @param {string} content - 完整內容
   * @param {number} maxLength - 最大長度
   * @returns {string} 內容預覽
   */
  createContentPreview(content, maxLength = 500) {
    if (!content) return "";

    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + "...";
  }

  /**
   * 計算字數
   * @param {string} content - 內容
   * @returns {number} 字數
   */
  countWords(content) {
    if (!content) return 0;

    // 中文字符和英文單詞的計算
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;

    return chineseChars + englishWords;
  }

  /**
   * 取得支援的檔案格式
   * @returns {Array<string>} 支援的副檔名陣列
   */
  getSupportedExtensions() {
    return Object.keys(this.supportedExtensions);
  }

  /**
   * 檢查檔案格式是否支援
   * @param {string} fileExtension - 檔案副檔名
   * @returns {boolean} 是否支援
   */
  isSupported(fileExtension) {
    return this.supportedExtensions.hasOwnProperty(fileExtension.toLowerCase());
  }

  /**
   * 歸檔已處理的檔案
   * @param {string} filePath - 檔案路徑
   * @param {Object} documentData - 文件資料
   */
  async archiveProcessedFile(filePath, documentData) {
    try {
      const archivedPath = await fileArchivingService.archiveFile(
        filePath,
        documentData
      );

      if (archivedPath) {
        // 建立歸檔記錄
        await fileArchivingService.createArchiveRecord(
          documentData.id,
          filePath,
          archivedPath
        );

        // 更新文件記錄中的歸檔路徑
        await this.updateDocumentArchivePath(documentData.id, archivedPath);
      }
    } catch (error) {
      logger.logError(`歸檔檔案失敗: ${filePath}`, error);
      // 歸檔失敗不影響主要處理流程
    }
  }

  /**
   * 更新文件的歸檔路徑
   * @param {number} documentId - 文件 ID
   * @param {string} archivedPath - 歸檔路徑
   */
  async updateDocumentArchivePath(documentId, archivedPath) {
    try {
      const dbConnection = require("../database/connection");
      const connection = await dbConnection.pool.getConnection();

      const sql = `
        UPDATE kess_documents 
        SET archive_path = ?, is_archived = 1, archived_at = NOW(), updated_at = NOW() 
        WHERE id = ?
      `;

      await connection.execute(sql, [archivedPath, documentId]);
      connection.release();

      logger.info(`已更新文件歸檔路徑: ${documentId} -> ${archivedPath}`);
    } catch (error) {
      logger.logError(`更新歸檔路徑失敗`, error);
    }
  }

  /**
   * 記錄處理錯誤
   * @param {number} documentId - 文件 ID
   * @param {Error} error - 錯誤物件
   */
  async logProcessingError(documentId, error) {
    try {
      const dbConnection = require("../database/connection");
      const connection = await dbConnection.pool.getConnection();

      const sql = `
        INSERT INTO kess_processing_logs (
          document_id, operation_type, status, message, created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `;

      const message = JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      await connection.execute(sql, [
        documentId,
        "processing",
        "error",
        message,
      ]);

      connection.release();
    } catch (logError) {
      logger.logError("記錄處理錯誤失敗", logError);
    }
  }
}

module.exports = DocumentProcessor;
