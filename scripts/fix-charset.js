const mysql = require("mysql2/promise");
const config = require("../config");
const logger = require("../src/utils/logger");

/**
 * 修正資料庫中文編碼問題的腳本
 */
async function fixCharset() {
  let connection;

  try {
    logger.info("開始修正資料庫中文編碼問題...");

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
    await connection.execute("SET CHARACTER SET utf8mb4");
    await connection.execute("SET character_set_connection=utf8mb4");
    await connection.execute("SET character_set_results=utf8mb4");
    await connection.execute("SET character_set_client=utf8mb4");

    logger.info("正在檢查和修正表格字元集...");

    // 確保所有 KESS 表格使用 utf8mb4
    const tables = [
      "kess_categories",
      "kess_documents",
      "kess_summaries",
      "kess_processing_logs",
      "kess_watched_folders",
      "kess_system_settings",
    ];

    for (const table of tables) {
      try {
        await connection.execute(
          `ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        logger.info(`已修正表格 ${table} 的字元集`);
      } catch (error) {
        logger.warn(`表格 ${table} 字元集修正失敗: ${error.message}`);
      }
    }

    // 重新插入系統設定（清除舊的亂碼資料）
    logger.info("重新插入系統設定資料...");

    await connection.execute("DELETE FROM kess_system_settings WHERE id < 5");

    const systemSettings = [
      ["system_version", "1.0.0", "string", "系統版本"],
      ["auto_process_enabled", "true", "boolean", "是否啟用自動處理"],
      ["max_concurrent_jobs", "5", "number", "最大並發處理任務數"],
      ["default_summary_language", "zh-TW", "string", "預設摘要語言"],
      ["summary_max_length", "500", "number", "摘要最大長度"],
      ["batch_processing_enabled", "true", "boolean", "是否啟用批次處理"],
      ["archive_after_processing", "true", "boolean", "處理完成後是否歸檔"],
      ["email_notifications", "false", "boolean", "是否發送電子郵件通知"],
      ["log_retention_days", "30", "number", "日誌保留天數"],
      ["max_file_size_mb", "10", "number", "最大檔案大小(MB)"],
    ];

    for (const [key, value, type, description] of systemSettings) {
      await connection.execute(
        "INSERT IGNORE INTO kess_system_settings (setting_key, setting_value, setting_type, description, is_active) VALUES (?, ?, ?, ?, ?)",
        [key, value, type, description, true]
      );
    }

    logger.info("系統設定資料重新插入完成");

    // 驗證修正結果
    logger.info("驗證修正結果...");

    const [rows] = await connection.execute(
      "SELECT * FROM kess_system_settings ORDER BY id"
    );
    console.log("\n=== kess_system_settings 表格內容 ===");
    for (const row of rows) {
      console.log(`${row.setting_key}: ${row.description}`);
    }

    const [categoryRows] = await connection.execute(
      "SELECT category_code, category_name, description FROM kess_categories ORDER BY sort_order"
    );
    console.log("\n=== kess_categories 表格內容 ===");
    for (const row of categoryRows) {
      console.log(
        `${row.category_code}: ${row.category_name} - ${row.description}`
      );
    }

    logger.info("資料庫中文編碼問題修正完成！");
  } catch (error) {
    logger.error("修正資料庫編碼時發生錯誤:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  fixCharset()
    .then(() => {
      console.log("資料庫編碼修正完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("修正失敗:", error);
      process.exit(1);
    });
}

module.exports = { fixCharset };
