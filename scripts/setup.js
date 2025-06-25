#!/usr/bin/env node

/**
 * KESS 系統設置腳本
 */

const fs = require("fs-extra");
const path = require("path");
const readline = require("readline");
const DatabaseMigration = require("../src/database/migrations/migrate");
const logger = require("../src/utils/logger");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log("=".repeat(50));
  console.log("🚀 KESS 知識提取與摘要系統設置");
  console.log("=".repeat(50));

  try {
    // 1. 檢查環境設定檔
    await checkEnvironmentFile();

    // 2. 建立必要目錄
    await createDirectories();

    // 3. 資料庫設置
    await setupDatabase();

    // 4. 測試 LLM 連線
    await testLLMConnection();

    // 5. 設置完成
    console.log("\n✅ KESS 系統設置完成！");
    console.log("\n使用方式:");
    console.log("  npm start    # 啟動系統");
    console.log("  npm run dev  # 開發模式");
    console.log("  npm test     # 執行測試");
  } catch (error) {
    console.error("\n❌ 設置失敗:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function checkEnvironmentFile() {
  console.log("\n📋 檢查環境設定檔...");

  const envPath = path.join(__dirname, "../.env");
  const envExamplePath = path.join(__dirname, "../.env.example");

  if (!(await fs.pathExists(envPath))) {
    console.log("❗ 未找到 .env 檔案");

    const createEnv = await ask("是否要複製 .env.example 為 .env？(y/N): ");
    if (createEnv.toLowerCase() === "y") {
      await fs.copy(envExamplePath, envPath);
      console.log("✅ 已建立 .env 檔案");
      console.log("⚠️  請編輯 .env 檔案，設定正確的資料庫和 LLM 參數");
    } else {
      throw new Error("需要 .env 設定檔才能繼續");
    }
  } else {
    console.log("✅ .env 檔案存在");
  }
}

async function createDirectories() {
  console.log("\n📁 建立必要目錄...");

  const directories = ["logs", "data", "demo-data/documents"];

  for (const dir of directories) {
    const dirPath = path.join(__dirname, "..", dir);
    await fs.ensureDir(dirPath);
    console.log(`✅ 建立目錄: ${dir}`);
  }

  // 建立範例文件
  const sampleFile = path.join(__dirname, "../demo-data/documents/sample.txt");
  if (!(await fs.pathExists(sampleFile))) {
    await fs.writeFile(
      sampleFile,
      `這是一個範例文件，用於測試 KESS 系統。

KESS (Knowledge Extraction and Summary System) 是一個智能文件監控與摘要系統。

主要功能包括：
1. 自動監控指定資料夾的文件變更
2. 支援多種文件格式（TXT, MD, PDF, DOCX, XLSX）
3. 使用大語言模型生成智能摘要
4. 提取關鍵詞和實體資訊
5. 儲存結果到 MySQL 資料庫

系統採用 Node.js 開發，具有良好的可擴展性和穩定性。

建立時間: ${new Date().toLocaleString("zh-TW")}
`
    );
    console.log("✅ 建立範例文件: demo-data/documents/sample.txt");
  }
}

async function setupDatabase() {
  console.log("\n🗄️  設置資料庫...");

  try {
    const migration = new DatabaseMigration();

    // 檢查表格狀態
    const tableStatus = await migration.checkTables();
    const missingTables = Object.entries(tableStatus)
      .filter(([table, exists]) => !exists)
      .map(([table]) => table);

    if (missingTables.length > 0) {
      console.log(`❗ 缺少資料庫表格: ${missingTables.join(", ")}`);

      const runMigration = await ask("是否要執行資料庫遷移？(Y/n): ");
      if (runMigration.toLowerCase() !== "n") {
        await migration.migrate();
        console.log("✅ 資料庫遷移完成");
      }
    } else {
      console.log("✅ 所有資料庫表格都已存在");
    }

    // 初始化監控資料夾
    const config = require("../config");
    await migration.initializeWatchedFolders(config.monitoring.watchFolders);
    console.log("✅ 監控資料夾設定完成");
  } catch (error) {
    console.log("❌ 資料庫設置失敗:", error.message);
    console.log("請檢查 .env 檔案中的資料庫設定");
    throw error;
  }
}

async function testLLMConnection() {
  console.log("\n🤖 測試 LLM 連線...");

  try {
    const config = require("../config");
    const SummaryService = require("../src/services/summary-service");

    const summaryService = new SummaryService();
    await summaryService.initialize();

    console.log(`✅ LLM 連線成功 (${config.llm.provider})`);
  } catch (error) {
    console.log("❌ LLM 連線失敗:", error.message);
    console.log("請檢查 .env 檔案中的 LLM 設定");

    const continueSetup = await ask("是否要繼續設置（跳過 LLM 測試）？(y/N): ");
    if (continueSetup.toLowerCase() !== "y") {
      throw error;
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("設置過程發生錯誤:", error);
    process.exit(1);
  });
}

module.exports = { main };
