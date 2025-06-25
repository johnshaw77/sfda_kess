#!/usr/bin/env node

/**
 * 手動測試單個檔案處理
 */

const path = require("path");
const DocumentProcessor = require("../src/processor/document-processor");
const SummaryService = require("../src/services/summary-service");
const dbConnection = require("../src/database/connection");
const logger = require("../src/utils/logger");

async function testSingleFileProcessing() {
  let summaryService = null;

  try {
    console.log("🧪 開始單個檔案處理測試...");

    // 初始化資料庫
    await dbConnection.initialize();

    // 初始化服務
    const documentProcessor = new DocumentProcessor();
    summaryService = new SummaryService();
    await summaryService.initialize();

    // 測試檔案路徑（選擇一個較小的檔案）
    const testFilePath =
      "/Users/johnshaw77/Documents/flexium/品質系統文件/【附件2】.docx";

    console.log(`📄 處理檔案: ${path.basename(testFilePath)}`);

    // 獲取檔案資訊
    const fs = require("fs-extra");
    const stats = await fs.stat(testFilePath);
    const fileInfo = {
      fileName: path.basename(testFilePath),
      fileExtension: path.extname(testFilePath),
      fileSize: stats.size,
      fileModifiedTime: stats.mtime,
    };

    console.log(`📊 檔案大小: ${(fileInfo.fileSize / 1024).toFixed(2)} KB`);

    // 處理文件
    console.log("🔄 開始處理文件...");
    const documentData = await documentProcessor.processFile(
      testFilePath,
      fileInfo
    );

    console.log("✅ 文件處理完成");
    console.log(`📝 內容長度: ${documentData.content.length} 字符`);
    console.log(`🔤 字數: ${documentData.wordCount} 字`);
    console.log(`📖 內容預覽: ${documentData.content.substring(0, 200)}...`);

    // 生成摘要
    console.log("\n🤖 開始生成摘要...");
    try {
      // 假設有一個文件 ID（實際使用時從資料庫獲取）
      const mockDocumentId = 999;
      await summaryService.generateSummary(mockDocumentId, documentData);
      console.log("✅ 摘要生成完成！");
    } catch (summaryError) {
      console.error(`❌ 摘要生成失敗: ${summaryError.message}`);
      console.error(summaryError.stack);
    }

    // 檢查資料庫是否存在重複記錄
    const connection = await dbConnection.pool.getConnection();
    try {
      const [existingFiles] = await connection.execute(
        "SELECT id, file_path, processing_status FROM kess_documents WHERE file_path LIKE ?",
        [`%${path.basename(testFilePath)}%`]
      );

      if (existingFiles.length > 0) {
        console.log(`⚠️  發現 ${existingFiles.length} 個重複記錄:`);
        existingFiles.forEach((file) => {
          console.log(
            `   - ID: ${file.id}, 路徑: ${file.file_path}, 狀態: ${file.processing_status}`
          );
        });
      } else {
        console.log("✅ 資料庫中沒有重複記錄");
      }
    } finally {
      connection.release();
    }

    console.log("\n🎯 測試完成！檔案處理功能正常運作");
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`);
    console.error(error.stack);
  } finally {
    if (summaryService) {
      await summaryService.cleanup();
    }
    await dbConnection.close();
  }
}

if (require.main === module) {
  testSingleFileProcessing();
}

module.exports = { testSingleFileProcessing };
