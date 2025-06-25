#!/usr/bin/env node

/**
 * Word 檔案處理測試腳本
 */

const path = require("path");
const fs = require("fs-extra");
const DocumentProcessor = require("../src/processor/document-processor");
const logger = require("../src/utils/logger");

async function testWordProcessing() {
  try {
    logger.info("🔄 開始 Word 檔案處理測試...");

    const documentProcessor = new DocumentProcessor();

    // 測試檔案清單
    const testFiles = [
      {
        name: "word測試文件.md",
        path: "./demo-data/word測試文件.md",
        description: "Markdown 格式測試檔案",
      },
    ];

    // 如果有真實的 Word 檔案，也加入測試
    const wordTestFiles = [
      "./demo-data/測試文件.docx",
      "./demo-data/測試文件.doc",
      "./demo-data/測試文件.rtf",
    ];

    for (const wordFile of wordTestFiles) {
      if (await fs.pathExists(wordFile)) {
        testFiles.push({
          name: path.basename(wordFile),
          path: wordFile,
          description: `Word 檔案 (${path.extname(wordFile)})`,
        });
      }
    }

    console.log(`\n📋 找到 ${testFiles.length} 個測試檔案\n`);

    for (const testFile of testFiles) {
      try {
        console.log(`🔍 測試檔案: ${testFile.name}`);
        console.log(`📄 類型: ${testFile.description}`);

        // 取得檔案資訊
        const stats = await fs.stat(testFile.path);
        const fileInfo = {
          fileName: testFile.name,
          fileExtension: path.extname(testFile.name),
          fileSize: stats.size,
          fileModifiedTime: stats.mtime,
        };

        console.log(`📊 檔案大小: ${(fileInfo.fileSize / 1024).toFixed(2)} KB`);
        console.log(
          `📅 修改時間: ${fileInfo.fileModifiedTime.toLocaleString()}`
        );

        // 處理檔案
        const startTime = Date.now();
        const documentData = await documentProcessor.processFile(
          testFile.path,
          fileInfo
        );
        const processingTime = Date.now() - startTime;

        console.log(`⏱️  處理時間: ${processingTime} ms`);
        console.log(`📝 內容長度: ${documentData.content.length} 字符`);
        console.log(`🔤 字數統計: ${documentData.wordCount} 字`);
        console.log(`📖 內容預覽:`);
        console.log(`${documentData.content.substring(0, 200)}...`);

        console.log(`✅ ${testFile.name} 處理成功\n${"=".repeat(60)}\n`);
      } catch (error) {
        console.log(
          `❌ ${testFile.name} 處理失敗: ${error.message}\n${"=".repeat(60)}\n`
        );
      }
    }

    console.log("🎯 Word 檔案處理測試完成！");

    // 檢查 textract 安裝狀況
    let textractStatus = "❌ 未安裝";
    try {
      require("textract");
      textractStatus = "✅ 已安裝";
    } catch (error) {
      // textract 未安裝
    }

    // 顯示支援的檔案格式
    console.log("\n📋 支援的檔案格式:");
    console.log("✅ .txt  - 純文字檔案");
    console.log("✅ .md   - Markdown 檔案");
    console.log("✅ .pdf  - PDF 檔案");
    console.log("✅ .docx - Word 2007+ 檔案");
    console.log(
      `${
        textractStatus === "✅ 已安裝" ? "✅" : "⚠️ "
      } .doc  - Word 97-2003 檔案 (textract ${textractStatus})`
    );
    console.log("✅ .rtf  - Rich Text Format 檔案");
    console.log("✅ .xlsx - Excel 檔案");
    console.log("✅ .xls  - Excel 97-2003 檔案");

    if (textractStatus === "❌ 未安裝") {
      console.log("\n💡 如需處理 .doc 檔案，請安裝額外套件:");
      console.log("   npm install textract");
      console.log("   (注意：textract 需要系統層級的依賴項目)");
    } else {
      console.log("\n🎉 所有主要檔案格式都已支援！");
      console.log("💡 可使用以下指令測試:");
      console.log("   npm run test:doc     - 測試 .doc 檔案處理");
      console.log("   npm run test:single  - 測試單一檔案");
    }
  } catch (error) {
    logger.logError("Word 檔案處理測試失敗", error);
    console.log(`❌ 測試失敗: ${error.message}`);
  }
}

// 執行測試
if (require.main === module) {
  testWordProcessing().catch(console.error);
}

module.exports = { testWordProcessing };
