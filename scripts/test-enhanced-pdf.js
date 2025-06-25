const fs = require("fs-extra");
const path = require("path");
const DocumentProcessor = require("../src/processor/document-processor");
const EnhancedPdfProcessor = require("../src/processor/enhanced-pdf-processor");

async function testEnhancedPdfProcessing() {
  try {
    console.log("=== KESS 增強版 PDF 處理測試 ===\n");

    const processor = new DocumentProcessor();
    const enhancedProcessor = new EnhancedPdfProcessor();

    // 顯示功能資訊
    console.log("增強版 PDF 處理器功能:");
    const stats = enhancedProcessor.getProcessingStats();
    console.log("支援語言:", stats.supportedLanguages.join(", "));
    console.log("主要功能:");
    stats.features.forEach((feature) => console.log(`  • ${feature}`));
    console.log("注意事項:");
    stats.limitations.forEach((limitation) =>
      console.log(`  ⚠️ ${limitation}`)
    );

    console.log("\n--- PDF 處理測試 ---");

    // 創建測試資料夾
    const testDataDir = path.join(__dirname, "..", "test_data");
    await fs.ensureDir(testDataDir);

    // 尋找測試用的 PDF 檔案
    const possiblePdfFiles = [
      path.join(testDataDir, "sample.pdf"),
      path.join(testDataDir, "test.pdf"),
      path.join(__dirname, "sample.pdf"),
      path.join(__dirname, "..", "docs", "*.pdf"),
    ];

    let testPdfPath = null;
    for (const pdfPath of possiblePdfFiles) {
      if (await fs.pathExists(pdfPath)) {
        testPdfPath = pdfPath;
        break;
      }
    }

    if (!testPdfPath) {
      console.log("❌ 找不到測試 PDF 檔案");
      console.log("請將測試 PDF 檔案放在以下任一位置:");
      possiblePdfFiles.forEach((path) => console.log(`  ${path}`));

      // 創建示例 PDF 檔案說明
      const samplePdfInfo = path.join(testDataDir, "PDF_TEST_INFO.txt");
      await fs.writeFile(
        samplePdfInfo,
        `
KESS 增強版 PDF 處理測試說明

要測試 PDF 處理功能，請將測試 PDF 檔案重新命名為 sample.pdf 並放在此目錄中。

支援的測試類型：
1. 純文字 PDF - 測試文字提取功能
2. 圖片型 PDF - 測試 OCR 識別功能
3. 中文 PDF - 測試中文處理優化
4. 混合內容 PDF - 測試完整處理流程

測試完成後會顯示：
- 處理方式（文字提取/OCR）
- 內容分析結果
- 處理時間和效能
- 結構化資訊

創建時間: ${new Date().toLocaleString()}
      `
      );
      console.log(`\n💡 已創建測試說明檔案: ${samplePdfInfo}`);
      return;
    }

    console.log(`✅ 找到測試 PDF 檔案: ${testPdfPath}\n`);

    // 測試基本 PDF 處理
    console.log("1️⃣ 測試基本 PDF 處理...");
    try {
      const startTime = Date.now();
      const basicContent = await processor.processPdfFile(testPdfPath);
      const basicTime = Date.now() - startTime;

      console.log(`✅ 基本處理成功 (${basicTime}ms)`);
      console.log(`   內容長度: ${basicContent.length} 字元`);
      console.log(`   內容預覽: ${basicContent.slice(0, 100)}...`);
    } catch (error) {
      console.log(`❌ 基本處理失敗: ${error.message}`);
    }

    // 測試增強版 PDF 處理
    console.log("\n2️⃣ 測試增強版 PDF 處理...");
    try {
      const startTime = Date.now();
      const detailedResult = await processor.processPdfFileDetailed(
        testPdfPath
      );
      const enhancedTime = Date.now() - startTime;

      console.log(`✅ 增強處理成功 (${enhancedTime}ms)`);
      console.log(`   檔案名稱: ${detailedResult.fileName}`);
      console.log(`   處理頁數: ${detailedResult.processing.pages}`);
      console.log(
        `   文字提取: ${detailedResult.processing.textExtraction ? "✅" : "❌"}`
      );
      console.log(
        `   OCR 需求: ${detailedResult.processing.ocrRequired ? "✅" : "❌"}`
      );
      console.log(
        `   OCR 執行: ${detailedResult.processing.ocrPerformed ? "✅" : "❌"}`
      );

      if (detailedResult.processing.errors.length > 0) {
        console.log(
          `   處理錯誤: ${detailedResult.processing.errors.join(", ")}`
        );
      }

      // 顯示結構化資訊
      if (detailedResult.structure) {
        console.log("\n📊 文件結構分析:");
        console.log(`   字數統計: ${detailedResult.structure.wordCount}`);
        console.log(`   行數統計: ${detailedResult.structure.lineCount}`);
        console.log(`   段落數量: ${detailedResult.structure.paragraphCount}`);
        console.log(
          `   包含中文: ${
            detailedResult.structure.hasChineseContent ? "✅" : "❌"
          }`
        );
        console.log(
          `   包含英文: ${
            detailedResult.structure.hasEnglishContent ? "✅" : "❌"
          }`
        );
        console.log(
          `   包含數字: ${detailedResult.structure.hasNumbers ? "✅" : "❌"}`
        );
        console.log(
          `   預估閱讀時間: ${detailedResult.structure.estimatedReadingTime} 分鐘`
        );

        if (
          detailedResult.structure.potentialTitles &&
          detailedResult.structure.potentialTitles.length > 0
        ) {
          console.log("   可能的標題:");
          detailedResult.structure.potentialTitles.forEach((title, index) => {
            console.log(
              `     ${index + 1}. ${title.slice(0, 50)}${
                title.length > 50 ? "..." : ""
              }`
            );
          });
        }
      }

      // 顯示內容預覽
      console.log(`\n📄 內容預覽 (前 200 字元):`);
      console.log(`${detailedResult.content.slice(0, 200)}...`);
    } catch (error) {
      console.log(`❌ 增強處理失敗: ${error.message}`);
    }

    // 效能比較
    console.log("\n3️⃣ 效能與功能比較");
    console.log("基本處理 vs 增強處理:");
    console.log("• 基本處理: 速度快，僅文字提取");
    console.log("• 增強處理: 功能完整，支援 OCR，結構化分析");
    console.log("• 建議: 一般文件使用增強處理，大批量處理考慮基本處理");
  } catch (error) {
    console.error("測試過程發生錯誤:", error);
  }
}

// 執行測試
testEnhancedPdfProcessing()
  .then(() => {
    console.log("\n=== 增強版 PDF 處理測試完成 ===");
  })
  .catch((error) => {
    console.error("測試失敗:", error);
  });
