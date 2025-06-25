#!/usr/bin/env node

/**
 * 測試 KESS 系統的 Windows 網路監控功能
 */

// 確保使用正確的工作目錄
process.chdir(__dirname);

// 載入配置
require("dotenv").config();

const KessApplication = require("./src/index");
const logger = require("./src/utils/logger");

async function testKessWithWindowsNetwork() {
  console.log("🧪 測試 KESS 系統的 Windows 網路監控功能...");

  let app = null;

  try {
    // 建立應用程式實例
    app = new KessApplication();

    console.log("📦 開始初始化 KESS 系統...");
    await app.initialize();

    console.log("🚀 開始啟動 KESS 系統...");
    await app.start();

    console.log("✅ KESS 系統啟動成功！");
    console.log("🎯 正在監控檔案變更...");
    console.log("按 Ctrl+C 可安全關閉系統");

    // 設定優雅關閉
    process.on("SIGINT", async () => {
      console.log("\n🛑 收到中斷訊號，正在關閉系統...");
      if (app) {
        await app.shutdown();
      }
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ 測試失敗:", error.message);
    console.error(error.stack);

    if (app) {
      try {
        await app.shutdown();
      } catch (shutdownError) {
        console.error("關閉系統時發生錯誤:", shutdownError.message);
      }
    }

    process.exit(1);
  }
}

// 啟動測試
testKessWithWindowsNetwork().catch(console.error);
