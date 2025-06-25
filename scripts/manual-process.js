#!/usr/bin/env node

/**
 * 手動觸發檔案處理測試腳本
 */

const path = require("path");
const config = require("../config");
const logger = require("../src/utils/logger");
const dbConnection = require("../src/database/connection");
const DocumentProcessor = require("../src/processor/document-processor");
const SummaryService = require("../src/services/summary-service");

async function testFileProcessing() {
  let summaryService = null;
  let documentProcessor = null;

  try {
    logger.info("開始手動檔案處理測試...");

    // 1. 初始化資料庫連線
    logger.info("初始化資料庫連線...");
    await dbConnection.initialize();
    logger.info("資料庫連線成功");

    // 2. 初始化服務
    logger.info("初始化服務模組...");
    documentProcessor = new DocumentProcessor();
    summaryService = new SummaryService();
    await summaryService.initialize();
    logger.info("服務模組初始化完成");

    // 3. 處理測試檔案
    const testFiles = [
      "./demo-data/品質檢驗報告_SMS-2025-001.md",
      "./demo-data/生產計劃_2025Q1.md",
    ];

    for (const testFile of testFiles) {
      try {
        const fullPath = path.resolve(testFile);
        logger.info(`開始處理檔案: ${testFile}`);

        // 獲取檔案資訊
        const fs = require("fs-extra");
        const stats = await fs.stat(fullPath);
        const fileInfo = {
          fileName: path.basename(testFile),
          fileExtension: path.extname(testFile),
          fileSize: stats.size,
          fileModifiedTime: stats.mtime,
        };

        logger.info(`檔案資訊: ${JSON.stringify(fileInfo)}`);

        // 處理文件
        const documentData = await documentProcessor.processFile(
          fullPath,
          fileInfo
        );
        logger.info(`文件處理完成: ${documentData.fileName}`);
        logger.info(`內容預覽: ${documentData.content.substring(0, 200)}...`);

        // 先儲存文件記錄以獲取 ID
        logger.info("儲存文件記錄到資料庫...");
        const connection = await dbConnection.pool.getConnection();

        // 插入文件記錄
        const [documentResult] = await connection.execute(
          `INSERT INTO kess_documents 
           (category_id, file_path, original_path, file_name, file_extension, 
            file_size, file_hash, file_modified_time, content_preview, word_count, 
            processing_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', NOW(), NOW())`,
          [
            1, // 預設分類 ID
            documentData.filePath,
            documentData.filePath,
            documentData.fileName,
            documentData.fileExtension,
            documentData.fileSize,
            documentData.fileHash,
            documentData.fileModifiedTime,
            documentData.content.substring(0, 500),
            documentData.wordCount || 0,
          ]
        );

        const documentId = documentResult.insertId;
        logger.info(`文件記錄已儲存，ID: ${documentId}`);

        // 生成摘要
        logger.info("開始生成摘要...");
        await summaryService.generateSummary(documentId, documentData);
        logger.info("摘要生成完成並已儲存到資料庫");

        // 更新處理狀態為完成
        await connection.execute(
          "UPDATE kess_documents SET processing_status = 'completed' WHERE id = ?",
          [documentId]
        );

        // 執行歸檔
        logger.info("開始執行檔案歸檔...");
        documentData.id = documentId;
        await documentProcessor.archiveProcessedFile(fullPath, documentData);
        logger.info("檔案歸檔完成");

        connection.release();
        logger.info(`✅ 檔案 "${testFile}" 處理完成\n`);
      } catch (error) {
        logger.logError(`處理檔案失敗: ${testFile}`, error);
      }
    }

    logger.info("手動檔案處理測試完成！");
  } catch (error) {
    logger.logError("手動處理測試失敗", error);
  } finally {
    // 清理資源
    logger.info("清理資源完成");
  }
}

// 執行測試
testFileProcessing().catch((error) => {
  logger.logError("未預期的錯誤", error);
  process.exit(1);
});
