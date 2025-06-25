#!/usr/bin/env node

/**
 * textract 套件功能測試
 */

const fs = require("fs-extra");
const path = require("path");

async function testTextract() {
  console.log("🧪 測試 textract 套件功能\n");

  try {
    const textract = require("textract");
    console.log("✅ textract 套件載入成功");

    // 測試支援的檔案格式
    const demoDir = path.join(__dirname, "../demo-data");
    const files = await fs.readdir(demoDir);

    console.log(`\n📂 demo-data 目錄下的檔案:`);
    files.forEach((file, index) => {
      const ext = path.extname(file).toLowerCase();
      console.log(`${index + 1}. ${file} (${ext})`);
    });

    // 篩選可能支援的檔案格式
    const supportedExts = [".txt", ".md", ".rtf", ".doc", ".docx", ".pdf"];
    const testFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return supportedExts.includes(ext);
    });

    if (testFiles.length === 0) {
      console.log("\n⚠️  沒有找到可測試的檔案");
      return;
    }

    console.log(`\n🎯 找到 ${testFiles.length} 個可測試的檔案:`);
    testFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    // 測試第一個檔案
    const testFile = path.join(demoDir, testFiles[0]);
    console.log(`\n🔍 測試檔案: ${testFiles[0]}`);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      textract.fromFileWithPath(
        testFile,
        {
          preserveLineBreaks: true,
          ignoreHiddenText: true,
        },
        (error, text) => {
          const endTime = Date.now();
          const processingTime = endTime - startTime;

          if (error) {
            console.log(`❌ textract 處理失敗: ${error.message}`);
            console.log(`🔧 可能的原因:`);
            console.log(`   - 檔案格式不支援`);
            console.log(`   - 缺少系統依賴項目`);
            console.log(`   - 檔案損壞或格式錯誤`);
            reject(error);
          } else {
            console.log(`✅ textract 處理成功！`);
            console.log(`⏱️  處理時間: ${processingTime}ms`);
            console.log(`📊 內容長度: ${text.length} 字符`);
            console.log(`📖 內容預覽:`);
            console.log(text.substring(0, 300));
            if (text.length > 300) {
              console.log("...");
            }
            resolve(text);
          }
        }
      );
    });
  } catch (error) {
    console.log(`❌ textract 套件載入失敗: ${error.message}`);
    console.log(`\n🔧 請確認 textract 套件是否正確安裝:`);
    console.log(`   npm list textract`);
    console.log(`\n📝 如果需要重新安裝:`);
    console.log(`   npm install textract`);
  }
}

async function testSpecificFile(filePath) {
  console.log(`🎯 測試特定檔案: ${filePath}\n`);

  try {
    const textract = require("textract");

    if (!(await fs.pathExists(filePath))) {
      throw new Error(`檔案不存在: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    console.log(`📄 檔案資訊:`);
    console.log(`   大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   修改時間: ${stats.mtime.toLocaleString()}`);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      textract.fromFileWithPath(
        filePath,
        {
          preserveLineBreaks: true,
          ignoreHiddenText: true,
        },
        (error, text) => {
          const endTime = Date.now();
          const processingTime = endTime - startTime;

          if (error) {
            console.log(`❌ 處理失敗: ${error.message}`);
            reject(error);
          } else {
            console.log(`✅ 處理成功！`);
            console.log(`⏱️  處理時間: ${processingTime}ms`);
            console.log(`📊 內容長度: ${text.length} 字符`);
            console.log(`📖 內容預覽:`);
            console.log(text.substring(0, 400));
            if (text.length > 400) {
              console.log("...");
            }
            resolve(text);
          }
        }
      );
    });
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  const filePath = process.argv[3];

  try {
    if (command === "file" && filePath) {
      await testSpecificFile(filePath);
    } else {
      await testTextract();
    }

    console.log("\n🎯 測試完成！");
  } catch (error) {
    console.error("\n💥 測試失敗:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testTextract, testSpecificFile };
