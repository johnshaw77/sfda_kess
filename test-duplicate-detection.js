const FileWatcher = require("./src/monitor/file-watcher");
const dbConnection = require("./src/database/connection");
const path = require("path");

async function testDuplicateDetection() {
  try {
    console.log("🔍 測試重複檢測機制...\n");

    // 初始化資料庫連接
    await dbConnection.initialize();

    // 建立檔案監控器
    const fileWatcher = new FileWatcher();

    // 測試檔案路徑（使用 demo-data 中的檔案）
    const testFilePath = path.join(__dirname, "demo-data", "品質檢驗報告_SMS-2025-001.md");

    console.log(`測試檔案: ${testFilePath}`);

    // 測試檢查檔案是否需要處理
    const needsProcessing = await fileWatcher.checkIfFileNeedsProcessing(testFilePath);

    console.log(`\n結果: ${needsProcessing ? "需要處理" : "跳過處理"}`);

    // 查詢資料庫中該檔案的記錄
    const existing = await dbConnection.query(
      `SELECT id, file_path, file_hash, processing_status, created_at, updated_at
       FROM kess_documents 
       WHERE file_path = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [path.resolve(testFilePath)]
    );

    if (existing.length > 0) {
      const record = existing[0];
      console.log(`\n📋 資料庫記錄:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  檔案路徑: ${record.file_path}`);
      console.log(`  檔案雜湊: ${record.file_hash}`);
      console.log(`  處理狀態: ${record.processing_status}`);
      console.log(`  建立時間: ${record.created_at}`);
      console.log(`  更新時間: ${record.updated_at}`);
    } else {
      console.log(`\n📋 資料庫中無此檔案記錄`);
    }

    // 關閉資料庫連接
    await dbConnection.close();

    console.log("\n✅ 測試完成");
  } catch (error) {
    console.error("❌ 測試失敗:", error);
  }
}

testDuplicateDetection();
