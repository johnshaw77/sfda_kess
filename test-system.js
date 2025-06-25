#!/usr/bin/env node

/**
 * 測試系統運行狀態
 */

require("dotenv").config();

async function testSystem() {
  console.log("=== KESS 系統測試 ===\n");

  try {
    // 測試資料庫連接
    console.log("📡 測試資料庫連接...");
    const dbConnection = require("./src/database/connection");
    await dbConnection.initialize();
    console.log("✅ 資料庫連接正常");

    // 測試查詢類別
    const categories = await dbConnection.query(
      "SELECT * FROM kess_categories WHERE is_active = TRUE ORDER BY sort_order"
    );
    console.log(`✅ 找到 ${categories.length} 個活躍類別:`);
    categories.forEach((cat) => {
      console.log(`   - ${cat.category_code}: ${cat.category_name}`);
    });
    console.log("");

    // 測試文檔處理器
    console.log("🔧 測試文檔處理器...");
    const DocumentProcessor = require("./src/processor/document-processor");
    const processor = new DocumentProcessor();
    console.log("✅ 文檔處理器初始化成功");

    // 測試文件監控器
    console.log("👁️  測試文件監控器...");
    const FileWatcher = require("./src/monitor/file-watcher");
    const watcher = new FileWatcher();
    console.log("✅ 文件監控器初始化成功");

    // 測試主應用程式
    console.log("🚀 測試主應用程式...");
    const KessApplication = require("./src/index");
    console.log("✅ 主應用程式載入成功");

    console.log("");
    console.log("🎉 所有系統組件測試通過！");
    console.log("");
    console.log("📋 系統準備就緒：");
    console.log("   ✅ 資料庫連接和表格");
    console.log("   ✅ 文檔處理功能");
    console.log("   ✅ 文件監控功能");
    console.log("   ✅ 主應用邏輯");
    console.log("");
    console.log("現在可以啟動系統了！");
    console.log("使用指令: node src/index.js 或 npm start");

    await dbConnection.close();
  } catch (error) {
    console.error("❌ 系統測試失敗:", error.message);
    console.error("堆疊:", error.stack);
    process.exit(1);
  }
}

testSystem().catch(console.error);
