const FileWatcher = require("./src/monitor/file-watcher");
const dbConnection = require("./src/database/connection");
const fs = require("fs-extra");
const path = require("path");

async function testVariousScenarios() {
  try {
    console.log("🔍 測試各種重複檢測情況...\n");

    // 初始化資料庫連接
    await dbConnection.initialize();

    // 建立檔案監控器
    const fileWatcher = new FileWatcher();

    // 測試案例 1: 已處理且雜湊相同的檔案
    console.log("=== 測試案例 1: 已處理的檔案 ===");
    const testFile1 = path.join(__dirname, "demo-data", "品質檢驗報告_SMS-2025-001.md");
    const needs1 = await fileWatcher.checkIfFileNeedsProcessing(testFile1);
    console.log(`結果: ${needs1 ? "需要處理" : "跳過處理"} ✓\n`);

    // 測試案例 2: 不存在於資料庫的檔案
    console.log("=== 測試案例 2: 新檔案（不存在於資料庫） ===");
    const testFile2 = path.join(__dirname, "demo-data", "測試DOC檔案.rtf");
    const needs2 = await fileWatcher.checkIfFileNeedsProcessing(testFile2);
    console.log(`結果: ${needs2 ? "需要處理" : "跳過處理"} ✓\n`);

    // 測試案例 3: 檢查資料庫中所有檔案的狀態
    console.log("=== 資料庫中的檔案狀態統計 ===");
    const [stats] = await dbConnection.query(`
      SELECT 
        processing_status,
        COUNT(*) as count,
        COUNT(CASE WHEN file_hash IS NOT NULL THEN 1 END) as with_hash
      FROM kess_documents 
      GROUP BY processing_status
    `);

    stats.forEach(stat => {
      console.log(`狀態: ${stat.processing_status}, 數量: ${stat.count}, 有雜湊: ${stat.with_hash}`);
    });

    console.log("\n=== 監控資料夾中的檔案檢測 ===");
    // 測試監控資料夾中的幾個檔案
    const demoFiles = await fs.readdir(path.join(__dirname, "demo-data"));
    let needProcessing = 0;
    let skipProcessing = 0;

    for (const fileName of demoFiles.slice(0, 5)) { // 只測試前5個檔案
      const filePath = path.join(__dirname, "demo-data", fileName);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const needs = await fileWatcher.checkIfFileNeedsProcessing(filePath);
        if (needs) {
          needProcessing++;
          console.log(`📝 需要處理: ${fileName}`);
        } else {
          skipProcessing++;
          console.log(`⏭️  跳過: ${fileName}`);
        }
      }
    }

    console.log(`\n📊 統計結果:`);
    console.log(`需要處理: ${needProcessing} 個檔案`);
    console.log(`可以跳過: ${skipProcessing} 個檔案`);

    // 關閉資料庫連接
    await dbConnection.close();

    console.log("\n✅ 所有測試完成");
    console.log("\n💡 重複檢測機制說明:");
    console.log("   • 新檔案或資料庫中不存在的檔案 → 需要處理");
    console.log("   • 檔案雜湊已變更 → 需要處理");
    console.log("   • 之前處理失敗的檔案 → 需要處理");
    console.log("   • 已完成處理且雜湊相同 → 跳過處理");

  } catch (error) {
    console.error("❌ 測試失敗:", error);
  }
}

testVariousScenarios();
