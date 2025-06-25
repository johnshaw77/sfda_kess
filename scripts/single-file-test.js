#!/usr/bin/env node

/**
 * 單一檔案處理測試腳本
 */

const path = require("path");
const fs = require("fs-extra");
const DocumentProcessor = require("../src/processor/document-processor");
const logger = require("../src/utils/logger");

async function testSingleFile(filePath) {
  try {
    console.log(`🧪 測試處理檔案: ${filePath}`);

    // 檢查檔案是否存在
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`檔案不存在: ${filePath}`);
    }

    // 獲取檔案資訊
    const stats = await fs.stat(filePath);
    const fileInfo = {
      fileName: path.basename(filePath),
      fileExtension: path.extname(filePath).toLowerCase(),
      fileSize: stats.size,
      fileModifiedTime: stats.mtime,
    };

    console.log(`📄 檔案資訊:`);
    console.log(`   名稱: ${fileInfo.fileName}`);
    console.log(`   格式: ${fileInfo.fileExtension}`);
    console.log(`   大小: ${(fileInfo.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   修改時間: ${fileInfo.fileModifiedTime.toLocaleString()}`);

    // 初始化文件處理器
    const documentProcessor = new DocumentProcessor();

    console.log(`\n🔄 開始處理檔案...`);
    const startTime = Date.now();

    // 處理檔案
    const documentData = await documentProcessor.processFile(
      filePath,
      fileInfo
    );

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`\n✅ 檔案處理完成！`);
    console.log(`⏱️  處理時間: ${processingTime}ms`);
    console.log(`📊 內容長度: ${documentData.content.length} 字符`);
    console.log(`🔤 字數統計: ${documentData.wordCount} 字`);
    console.log(`🔒 檔案雜湊: ${documentData.fileHash.substring(0, 16)}...`);

    console.log(`\n📖 內容預覽:`);
    console.log(documentData.content.substring(0, 300));
    if (documentData.content.length > 300) {
      console.log("...");
    }

    return documentData;
  } catch (error) {
    console.error(`❌ 處理失敗: ${error.message}`);
    throw error;
  }
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log("用法: node single-file-test.js <檔案路徑>");
    console.log("範例: node single-file-test.js ./demo-data/測試DOC檔案.rtf");
    process.exit(1);
  }

  try {
    await testSingleFile(filePath);
    console.log("\n🎯 測試完成！");
  } catch (error) {
    console.error("\n💥 測試失敗:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSingleFile };
