const mysql = require("mysql2/promise");
const config = require("../config");
const logger = require("../src/utils/logger");

/**
 * 簡化的中文資料測試
 */
async function simpleChineseTest() {
  let connection;

  try {
    logger.info("開始簡化中文資料測試...");

    // 建立連線
    connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      charset: "utf8mb4",
    });

    // 設定連線字元集
    await connection.execute("SET NAMES utf8mb4");

    // 查詢現有資料
    console.log("\n=== 檢查現有的中文資料 ===");

    // 檢查 kess_categories
    const [categories] = await connection.execute(`
      SELECT category_code, category_name, description 
      FROM kess_categories 
      ORDER BY sort_order
    `);

    console.log("分類資料:");
    for (const cat of categories) {
      console.log(
        `  ${cat.category_code}: ${cat.category_name} - ${cat.description}`
      );
    }

    // 檢查 kess_system_settings
    const [settings] = await connection.execute(`
      SELECT setting_key, description 
      FROM kess_system_settings 
      ORDER BY id
    `);

    console.log("\n系統設定:");
    for (const setting of settings) {
      console.log(`  ${setting.setting_key}: ${setting.description}`);
    }

    // 檢查 kess_documents
    const [documents] = await connection.execute(`
      SELECT d.id, d.file_name, d.content_preview, c.category_name
      FROM kess_documents d
      LEFT JOIN kess_categories c ON d.category_id = c.id
      ORDER BY d.id
    `);

    console.log("\n文件資料:");
    if (documents.length === 0) {
      console.log("  目前沒有文件資料");
    } else {
      for (const doc of documents) {
        console.log(`  ID: ${doc.id}`);
        console.log(`  檔案: ${doc.file_name}`);
        console.log(`  類別: ${doc.category_name || "未知"}`);
        console.log(`  預覽: ${doc.content_preview || "無"}`);
        console.log("  ---");
      }
    }

    // 檢查 kess_summaries
    const [summaries] = await connection.execute(`
      SELECT s.id, d.file_name, s.summary_text
      FROM kess_summaries s
      LEFT JOIN kess_documents d ON s.document_id = d.id
      ORDER BY s.id
    `);

    console.log("\n摘要資料:");
    if (summaries.length === 0) {
      console.log("  目前沒有摘要資料");
    } else {
      for (const summary of summaries) {
        console.log(`  摘要 ID: ${summary.id}`);
        console.log(`  檔案: ${summary.file_name || "未知"}`);
        console.log(`  摘要: ${summary.summary_text.substring(0, 100)}...`);
        console.log("  ---");
      }
    }

    // 檢查 kess_processing_logs
    const [logs] = await connection.execute(`
      SELECT l.id, l.log_message, l.processing_stage, d.file_name
      FROM kess_processing_logs l
      LEFT JOIN kess_documents d ON l.document_id = d.id
      ORDER BY l.created_at DESC
      LIMIT 5
    `);

    console.log("\n處理日誌:");
    if (logs.length === 0) {
      console.log("  目前沒有處理日誌");
    } else {
      for (const log of logs) {
        console.log(`  日誌 ID: ${log.id}`);
        console.log(`  檔案: ${log.file_name || "未知"}`);
        console.log(`  階段: ${log.processing_stage || "未知"}`);
        console.log(`  訊息: ${log.log_message}`);
        console.log("  ---");
      }
    }

    // 測試統計視圖
    console.log("\n=== 統計視圖測試 ===");
    const [stats] = await connection.execute(`
      SELECT 
        category_name as 類別名稱,
        total_documents as 文件數量,
        ROUND(total_file_size/1024/1024, 2) as 總大小MB,
        total_summaries as 摘要數量
      FROM kess_category_statistics
      WHERE total_documents > 0
    `);

    if (stats.length === 0) {
      console.log("目前沒有統計資料");
    } else {
      for (const stat of stats) {
        console.log(
          `類別: ${stat.類別名稱}, 文件數: ${stat.文件數量}, 大小: ${stat.總大小MB} MB, 摘要數: ${stat.摘要數量}`
        );
      }
    }

    logger.info("中文資料檢查完成！");
  } catch (error) {
    logger.error("檢查中文資料時發生錯誤:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  simpleChineseTest()
    .then(() => {
      console.log("\n✅ 中文資料檢查完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 檢查失敗:", error);
      process.exit(1);
    });
}

module.exports = { simpleChineseTest };
