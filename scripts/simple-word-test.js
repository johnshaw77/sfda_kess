#!/usr/bin/env node

/**
 * 簡單的 Word 檔案處理測試
 */

const DocumentProcessor = require("../src/processor/document-processor");
const logger = require("../src/utils/logger");
const path = require("path");
const fs = require("fs-extra");

async function simpleWordTest() {
  try {
    console.log("🔄 簡單 Word 檔案處理測試\n");

    const documentProcessor = new DocumentProcessor();
    const testFile = "./demo-data/word測試文件.md";

    // 檢查檔案是否存在
    if (!(await fs.pathExists(testFile))) {
      console.log("❌ 測試檔案不存在");
      return;
    }

    // 獲取檔案資訊
    const stats = await fs.stat(testFile);
    const fileInfo = {
      fileName: path.basename(testFile),
      fileExtension: path.extname(testFile),
      fileSize: stats.size,
      fileModifiedTime: stats.mtime,
    };

    console.log("📄 檔案資訊:");
    console.log(`   名稱: ${fileInfo.fileName}`);
    console.log(`   格式: ${fileInfo.fileExtension}`);
    console.log(`   大小: ${(fileInfo.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   修改: ${fileInfo.fileModifiedTime.toLocaleString()}\n`);

    // 處理檔案
    console.log("🔍 開始處理檔案...");
    const startTime = Date.now();
    const documentData = await documentProcessor.processFile(
      testFile,
      fileInfo
    );
    const processingTime = Date.now() - startTime;

    console.log("✅ 處理結果:");
    console.log(`   處理時間: ${processingTime} ms`);
    console.log(`   內容長度: ${documentData.content.length} 字符`);
    console.log(`   字數統計: ${documentData.wordCount} 字`);
    console.log(`   檔案雜湊: ${documentData.fileHash.substring(0, 16)}...`);

    console.log("\n📖 內容預覽:");
    console.log("-".repeat(60));
    console.log(documentData.content.substring(0, 300));
    if (documentData.content.length > 300) {
      console.log("...(內容省略)");
    }
    console.log("-".repeat(60));

    console.log("\n🎯 Word 檔案處理測試完成！");

    // 顯示當前支援的格式
    console.log("\n📋 KESS 系統支援的檔案格式:");
    console.log("✅ 文字檔案: .txt, .md");
    console.log("✅ Word 檔案: .docx");
    console.log("⚠️  舊版 Word: .doc (需要額外套件)");
    console.log("✅ RTF 檔案: .rtf");
    console.log("✅ Excel 檔案: .xlsx, .xls");
    console.log("✅ PDF 檔案: .pdf");
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`);
    logger.logError("Word 檔案處理測試失敗", error);
  }
}

// 執行測試
if (require.main === module) {
  simpleWordTest().catch(console.error);
}

module.exports = { simpleWordTest };
