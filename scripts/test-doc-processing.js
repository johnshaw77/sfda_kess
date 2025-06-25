#!/usr/bin/env node
/**
 * .doc 檔案處理測試腳本
 * 用於測試 textract 套件對舊版 Word 檔案的處理能力
 */

const fs = require("fs-extra");
const path = require("path");

async function createTestDocFile() {
  console.log("🔧 正在創建測試用 .doc 檔案...");

  // 由於無法直接創建 .doc 檔案，我們提供一個 RTF 檔案作為替代測試
  // RTF 檔案可以被 Microsoft Word 開啟並另存為 .doc 格式

  const rtfContent = `{\\rtf1\\ansi\\deff0 
{\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 
測試 Word 檔案處理功能\\par
\\par
這是一個用於測試 KESS 系統 .doc 檔案處理功能的測試文件。\\par
\\par
包含的測試內容：\\par
1. 中文文字處理測試\\par
2. 特殊字符：★▲※®©\\par
3. 數字和英文：ABC 123\\par
\\par
產品資訊：\\par
- 產品名稱：智慧型檔案處理系統\\par
- 版本：v1.0.0\\par
- 支援格式：.txt, .md, .pdf, .docx, .doc, .rtf, .xlsx, .xls\\par
\\par
此檔案可以用 Microsoft Word 開啟並另存為 .doc 格式進行測試。\\par
}`;

  const testFilePath = path.join(__dirname, "../demo-data/測試DOC檔案.rtf");

  await fs.writeFile(testFilePath, rtfContent, "utf8");
  console.log(`✅ 測試檔案已創建: ${testFilePath}`);
  console.log("\n📌 使用說明：");
  console.log("1. 用 Microsoft Word 開啟上述 RTF 檔案");
  console.log("2. 另存為 .doc 格式到同一目錄");
  console.log("3. 執行 npm run test:doc 測試 .doc 檔案處理");

  return testFilePath;
}

async function testDocProcessing() {
  console.log("\n🧪 測試 textract 套件安裝狀況...");

  try {
    const textract = require("textract");
    console.log("✅ textract 套件已安裝並可使用");

    // 檢查是否有 .doc 檔案可供測試
    const demoDir = path.join(__dirname, "../demo-data");
    const files = await fs.readdir(demoDir);
    const docFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".doc"
    );

    if (docFiles.length > 0) {
      console.log(`\n📄 找到 ${docFiles.length} 個 .doc 檔案：`);
      docFiles.forEach((file) => {
        console.log(`   - ${file}`);
      });

      // 測試第一個 .doc 檔案
      const testFile = path.join(demoDir, docFiles[0]);
      console.log(`\n🔍 測試處理檔案: ${docFiles[0]}`);

      return new Promise((resolve, reject) => {
        textract.fromFileWithPath(
          testFile,
          { preserveLineBreaks: true },
          (error, text) => {
            if (error) {
              console.log(`❌ 處理失敗: ${error.message}`);
              reject(error);
            } else {
              console.log(`✅ 處理成功！`);
              console.log(`📊 內容長度: ${text.length} 字符`);
              console.log(`📖 內容預覽:\n${text.substring(0, 200)}...`);
              resolve(text);
            }
          }
        );
      });
    } else {
      console.log("\n⚠️  未找到 .doc 檔案進行測試");
      console.log("請先創建或複製 .doc 檔案到 demo-data 目錄");
    }
  } catch (error) {
    console.log(`❌ textract 套件未正確安裝: ${error.message}`);
    console.log("\n🔧 請執行以下命令安裝：");
    console.log("   npm install textract");
    console.log("\n⚠️  注意：textract 可能需要系統層級的依賴項目");
  }
}

async function main() {
  console.log("🎯 .doc 檔案處理測試工具\n");

  const command = process.argv[2];

  switch (command) {
    case "create":
      await createTestDocFile();
      break;
    case "test":
      await testDocProcessing();
      break;
    default:
      console.log("用法:");
      console.log(
        "  node test-doc-processing.js create  - 創建測試用 RTF 檔案"
      );
      console.log("  node test-doc-processing.js test    - 測試 .doc 檔案處理");
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  createTestDocFile,
  testDocProcessing,
};
