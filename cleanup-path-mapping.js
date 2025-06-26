const mysql = require("mysql2/promise");
const config = require("./config");

async function cleanupPathMappingTable() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("🧹 清理不需要的資料表...\n");

    // 檢查是否存在 kess_path_category_mapping 表
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'kess_path_category_mapping'
    `);

    if (tables.length > 0) {
      console.log("找到 kess_path_category_mapping 表");

      // 先檢查表中是否有資料
      const [count] = await connection.execute(`
        SELECT COUNT(*) as total FROM kess_path_category_mapping
      `);

      console.log(`表中有 ${count[0].total} 筆資料`);

      if (count[0].total > 0) {
        console.log("正在清空表資料...");
        await connection.execute("DELETE FROM kess_path_category_mapping");
        console.log("✅ 已清空表資料");
      }

      console.log("正在刪除表...");
      await connection.execute("DROP TABLE kess_path_category_mapping");
      console.log("✅ 已刪除 kess_path_category_mapping 表");
    } else {
      console.log("❌ kess_path_category_mapping 表不存在，無需清理");
    }

    // 顯示當前所有的 kess_ 相關表
    const [allKessTables] = await connection.execute(`
      SHOW TABLES LIKE 'kess_%'
    `);

    console.log("\n📋 目前的 KESS 相關資料表:");
    allKessTables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`  ${index + 1}. ${tableName}`);
    });

    await connection.end();

    console.log(
      "\n✨ 清理完成！現在只使用 kess_categories 表的 watch_folder 欄位來處理路徑對應。"
    );
  } catch (error) {
    console.error("❌ 清理失敗:", error);
  }
}

cleanupPathMappingTable();
