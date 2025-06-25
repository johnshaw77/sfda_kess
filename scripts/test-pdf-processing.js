const fs = require("fs-extra");
const path = require("path");
const DocumentProcessor = require("../src/processor/document-processor");

async function testPdfProcessing() {
  try {
    console.log("=== KESS PDF 處理測試 ===\n");

    const processor = new DocumentProcessor();

    // 檢查 PDF 支援
    console.log("支援的檔案格式:");
    const supportedExtensions = Object.keys(processor.supportedExtensions);
    supportedExtensions.forEach((ext) => {
      console.log(`  ${ext} - ${ext === ".pdf" ? "✓ 支援" : "支援"}`);
    });

    console.log("\n--- PDF 處理測試 ---");

    // 尋找測試用的 PDF 檔案
    const testPdfPath = path.join(__dirname, "..", "test_data", "sample.pdf");

    if (await fs.pathExists(testPdfPath)) {
      console.log(`找到測試 PDF 檔案: ${testPdfPath}`);

      // 測試 PDF 處理
      try {
        const content = await processor.processPdfFile(testPdfPath);
        console.log("PDF 內容提取成功!");
        console.log(`內容長度: ${content.length} 字元`);
        console.log(`內容預覽: ${content.substring(0, 200)}...`);
      } catch (error) {
        console.error("PDF 處理失敗:", error.message);
      }
    } else {
      console.log(`測試 PDF 檔案不存在: ${testPdfPath}`);
      console.log("請將測試 PDF 檔案放在 test_data/sample.pdf");
    }

    // 檢查 pdf-parse 套件
    console.log("\n--- PDF 套件檢查 ---");
    try {
      const pdfParse = require("pdf-parse");
      console.log("✓ pdf-parse 套件載入成功");
      console.log(`版本: ${require("pdf-parse/package.json").version}`);
    } catch (error) {
      console.error("✗ pdf-parse 套件載入失敗:", error.message);
    }

    // 檢查完整的檔案處理流程
    console.log("\n--- 完整檔案處理流程測試 ---");
    if (await fs.pathExists(testPdfPath)) {
      try {
        const stats = await fs.stat(testPdfPath);
        const fileInfo = {
          fileName: path.basename(testPdfPath),
          fileExtension: path.extname(testPdfPath),
          fileSize: stats.size,
          fileModifiedTime: stats.mtime,
        };

        console.log("檔案資訊:", fileInfo);

        const documentData = await processor.processFile(testPdfPath, fileInfo);
        console.log("✓ 完整檔案處理成功!");
        console.log(
          `處理結果 - 字數: ${documentData.wordCount}, 內容長度: ${documentData.content.length}`
        );
      } catch (error) {
        console.error("✗ 完整檔案處理失敗:", error.message);
      }
    }
  } catch (error) {
    console.error("測試過程發生錯誤:", error);
  }
}

// 執行測試
testPdfProcessing()
  .then(() => {
    console.log("\n=== 測試完成 ===");
  })
  .catch((error) => {
    console.error("測試失敗:", error);
  });
