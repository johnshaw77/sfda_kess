#!/usr/bin/env node

/**
 * 測試修復的問題：副檔名提取和數據庫參數處理
 */

const path = require("path");
const fs = require("fs-extra");

// 測試副檔名提取功能
function testFileExtensionExtraction() {
  console.log("=== 測試副檔名提取功能 ===");

  const testCases = [
    "P:\\TOJohn\\WWQ048 外來資料文件作業指示書.doc",
    "Z:\\TOJohn\\P0103.14.0.經營計畫管理程序20241204_V14.docx",
    "C:\\Test\\文件.pdf",
    "/network/share/document without extension",
    "file.with.multiple.dots.txt",
  ];

  testCases.forEach((filePath) => {
    console.log(`測試檔案: ${filePath}`);

    // 使用 Node.js 內建方法
    const nodeExtension = path.extname(filePath).toLowerCase();
    console.log(`  Node.js path.extname(): ${nodeExtension || "(空)"}`);

    // 使用手動提取方法（模擬我們的修復邏輯）
    let manualExtension = nodeExtension;
    if (!manualExtension && filePath.includes(".")) {
      const lastDotIndex = filePath.lastIndexOf(".");
      if (lastDotIndex > -1) {
        manualExtension = filePath.substring(lastDotIndex).toLowerCase();
      }
    }
    console.log(`  手動提取: ${manualExtension || "(空)"}`);

    // 從檔案名稱提取
    const fileName = path.basename(filePath);
    let fileNameExtension = null;
    if (!manualExtension && fileName.includes(".")) {
      const lastDotIndex = fileName.lastIndexOf(".");
      if (lastDotIndex > -1) {
        fileNameExtension = fileName.substring(lastDotIndex).toLowerCase();
      }
    }
    console.log(`  從檔案名稱提取: ${fileNameExtension || "(空)"}`);

    console.log("---");
  });
}

// 測試數據庫參數安全處理
function testDatabaseParameterSafety() {
  console.log("\n=== 測試數據庫參數安全處理 ===");

  const testDocumentData = {
    filePath: "P:\\TOJohn\\test.doc",
    fileName: "test.doc",
    fileExtension: ".doc",
    fileSize: undefined, // 可能導致問題的 undefined 值
    fileHash: null,
    fileModifiedTime: undefined, // 可能導致問題的 undefined 值
    contentPreview: "Test content",
    wordCount: undefined, // 可能導致問題的 undefined 值
  };

  console.log("原始數據:", testDocumentData);

  // 模擬我們的安全處理邏輯
  const safeDocumentData = {
    categoryId: 1,
    filePath: testDocumentData.filePath || null,
    fileName: testDocumentData.fileName || null,
    fileExtension: testDocumentData.fileExtension || null,
    fileSize:
      typeof testDocumentData.fileSize === "number"
        ? testDocumentData.fileSize
        : null,
    fileHash: testDocumentData.fileHash || null,
    fileModifiedTime:
      testDocumentData.fileModifiedTime instanceof Date
        ? testDocumentData.fileModifiedTime
        : null,
    contentPreview: testDocumentData.contentPreview || null,
    wordCount:
      typeof testDocumentData.wordCount === "number"
        ? testDocumentData.wordCount
        : 0,
  };

  console.log("安全處理後的數據:", safeDocumentData);

  // 檢查是否還有 undefined 值
  const hasUndefined = Object.values(safeDocumentData).some(
    (value) => value === undefined
  );
  console.log(`包含 undefined 值: ${hasUndefined ? "是" : "否"}`);

  if (hasUndefined) {
    console.log("❌ 仍然包含 undefined 值，需要進一步修復");
  } else {
    console.log("✅ 所有值都已安全處理");
  }
}

// 測試 antiword 錯誤處理
function testAntiwordErrorHandling() {
  console.log("\n=== 測試 antiword 錯誤處理 ===");

  const antiwordErrors = [
    "'antiword' 不是內部或外部命令，也不是可運行的程序或批處理文件。",
    "antiword: command not found",
    "Error: Command failed: antiword not recognized",
    "antiword read of file failed: Error: Command failed",
  ];

  antiwordErrors.forEach((errorMessage, index) => {
    console.log(`測試錯誤 ${index + 1}: ${errorMessage}`);

    const isAntiwordError =
      errorMessage.includes("antiword") &&
      (errorMessage.includes("not recognized") ||
        errorMessage.includes("不是內部或外部命令") ||
        errorMessage.includes("找不到指定的檔案") ||
        errorMessage.includes("not found") ||
        errorMessage.includes("command not found") ||
        errorMessage.includes("Command failed: antiword") ||
        errorMessage.includes("antiword read of file") ||
        errorMessage.includes("failed: Error: Command failed"));

    console.log(`  識別為 antiword 錯誤: ${isAntiwordError ? "是" : "否"}`);

    if (isAntiwordError) {
      console.log("  ✅ 將提供友善的錯誤訊息");
    } else {
      console.log("  ❌ 可能不會被識別為 antiword 錯誤");
    }
    console.log("---");
  });
}

// 運行所有測試
function runAllTests() {
  console.log("開始測試修復的問題...\n");

  testFileExtensionExtraction();
  testDatabaseParameterSafety();
  testAntiwordErrorHandling();

  console.log("\n測試完成！");
}

// 如果直接運行此文件
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testFileExtensionExtraction,
  testDatabaseParameterSafety,
  testAntiwordErrorHandling,
  runAllTests,
};
