#!/usr/bin/env node

/**
 * 建立測試用的 DOCX 檔案
 * 注意：這個腳本需要安裝 officegen 套件來建立真正的 .docx 檔案
 */

const fs = require("fs-extra");
const path = require("path");

async function createTestDocx() {
  console.log("📝 建立測試用 Word 檔案...");

  try {
    // 嘗試使用 officegen 建立 .docx 檔案
    try {
      const officegen = require("officegen");

      const docx = officegen("docx");

      // 建立文件內容
      const pObj = docx.createP();
      pObj.addText("KESS 系統 Word 檔案處理測試", {
        bold: true,
        font_size: 18,
      });

      docx
        .createP()
        .addText("這是一個測試文件，用於驗證 KESS 系統處理 Word 檔案的能力。");

      const listObj = docx.createP();
      listObj.addText("測試項目包括：");

      docx.createP().addText("1. 中文字符處理");
      docx.createP().addText("2. 格式識別");
      docx.createP().addText("3. 內容提取");

      docx.createP().addText("產品資訊：", { bold: true });
      docx.createP().addText("產品名稱：智慧型手機保護殼");
      docx.createP().addText("型號：SP-2025-001");
      docx.createP().addText("材質：PC+TPU 複合材料");

      // 儲存檔案
      const outputPath = path.join(__dirname, "../demo-data/測試文件.docx");
      const out = fs.createWriteStream(outputPath);

      docx.generate(out);

      await new Promise((resolve, reject) => {
        out.on("close", () => {
          console.log(`✅ DOCX 檔案已建立: ${outputPath}`);
          resolve();
        });
        out.on("error", reject);
      });
    } catch (error) {
      console.log("ℹ️  officegen 套件未安裝，建立簡易測試檔案...");

      // 建立一個純文字檔案作為替代
      const textContent = `KESS 系統 Word 檔案處理測試

這是一個測試文件，用於驗證 KESS 系統處理 Word 檔案的能力。

測試項目包括：
1. 中文字符處理
2. 格式識別  
3. 內容提取

產品資訊：
- 產品名稱：智慧型手機保護殼
- 型號：SP-2025-001
- 材質：PC+TPU 複合材料
- 顏色：透明、黑色、藍色
- 重量：35±2g

品質標準：
厚度: 1.2±0.1mm
硬度: Shore A 85±5
透光率: ≥95%

結論：
本文件用於測試 KESS 系統對文件的處理能力，包含中文字符、數字、特殊符號等多種內容類型。`;

      await fs.writeFile(
        path.join(__dirname, "../demo-data/word測試內容.txt"),
        textContent,
        "utf8"
      );

      console.log("✅ 純文字測試檔案已建立");
    }
  } catch (error) {
    console.error("❌ 建立測試檔案失敗:", error.message);
  }
}

async function installWordPackages() {
  console.log("\n📦 Word 檔案處理相關套件安裝指南:");
  console.log("=".repeat(50));

  console.log("\n✅ 已安裝的套件 (基本 Word 支援):");
  console.log("   mammoth    - 處理 .docx 檔案");
  console.log("   pdf-parse  - 處理 PDF 檔案");
  console.log("   xlsx       - 處理 Excel 檔案");

  console.log("\n📥 可選安裝的套件 (擴展支援):");
  console.log("   npm install textract        # 支援 .doc, .ppt, .odt 等");
  console.log("   npm install officegen       # 建立 Word/Excel 檔案");
  console.log("   npm install node-pandoc     # 文件格式轉換");

  console.log("\n⚠️  系統需求 (對於 textract):");
  console.log("   macOS: brew install antiword poppler tesseract");
  console.log(
    "   Ubuntu: apt-get install antiword poppler-utils tesseract-ocr"
  );
  console.log("   Windows: 需要手動安裝相關工具");

  console.log("\n🔧 建議安裝 (如需完整 Word 支援):");
  console.log("   npm install textract antiword --save");
}

// 命令列介面
async function main() {
  const command = process.argv[2];

  switch (command) {
    case "create":
      await createTestDocx();
      break;
    case "guide":
      await installWordPackages();
      break;
    default:
      console.log(`
📄 Word 檔案處理工具

使用方式:
  node scripts/word-helper.js create    # 建立測試用 Word 檔案
  node scripts/word-helper.js guide     # 顯示套件安裝指南

當前支援的格式:
  ✅ .docx (Word 2007+)
  ⚠️  .doc  (需要額外套件)
  ✅ .rtf  (Rich Text Format)
  ✅ .txt  (純文字)
  ✅ .md   (Markdown)
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTestDocx, installWordPackages };
