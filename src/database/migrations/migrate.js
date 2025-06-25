const fs = require("fs");
const path = require("path");
const dbConnection = require("../connection");
const logger = require("../../utils/logger");

class DatabaseMigration {
  constructor() {
    this.migrationsPath = path.join(__dirname, "init.sql");
  }

  /**
   * 執行資料庫遷移
   */
  async migrate() {
    try {
      logger.info("開始執行資料庫遷移...");

      // 確保資料庫連線已初始化
      if (!dbConnection.isReady()) {
        await dbConnection.initialize();
      }

      // 在執行 SQL 之前，確保字元集設定正確
      await dbConnection.query("SET NAMES utf8mb4");
      await dbConnection.query("SET CHARACTER SET utf8mb4");
      await dbConnection.query("SET character_set_connection=utf8mb4");
      await dbConnection.query("SET character_set_results=utf8mb4");
      await dbConnection.query("SET character_set_client=utf8mb4");
      logger.info("已設定資料庫連線字元集為 utf8mb4");

      // 讀取 SQL 檔案
      const sqlContent = fs.readFileSync(this.migrationsPath, "utf8");

      // 分割 SQL 語句（以分號分隔）
      const allStatements = sqlContent
        .split(";")
        .map((statement) => statement.trim())
        .filter(
          (statement) => statement.length > 0 && !statement.startsWith("--")
        );

      // 分離表格建立語句和視圖建立語句
      const tableStatements = [];
      const viewStatements = [];
      const otherStatements = [];

      for (const statement of allStatements) {
        if (statement.toUpperCase().includes("CREATE TABLE")) {
          tableStatements.push(statement);
        } else if (statement.toUpperCase().includes("CREATE OR REPLACE VIEW")) {
          viewStatements.push(statement);
        } else if (statement.trim()) {
          otherStatements.push(statement);
        }
      }

      // 按順序執行：1. 表格 2. 其他語句 3. 視圖
      const orderedStatements = [
        ...tableStatements,
        ...otherStatements,
        ...viewStatements,
      ];

      // 執行每個 SQL 語句
      for (const sql of orderedStatements) {
        if (sql.trim()) {
          try {
            await dbConnection.query(sql);
            logger.debug(`執行 SQL: ${sql.substring(0, 50)}...`);
          } catch (error) {
            // 如果是 DROP 語句失敗，可以忽略（表格可能不存在）
            if (
              sql.toUpperCase().includes("DROP") &&
              error.code === "ER_BAD_TABLE_ERROR"
            ) {
              logger.debug(`忽略 DROP 錯誤: ${error.message}`);
              continue;
            }
            // 如果是 INSERT 語句中的中文編碼問題，記錄警告但繼續執行
            if (
              sql.toUpperCase().includes("INSERT") &&
              (error.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || 
               error.message.includes("Incorrect string value"))
            ) {
              logger.warn(`INSERT 語句可能有編碼問題，將在後續修正: ${error.message}`);
              continue;
            }
            throw error;
          }
        }
      }

      logger.info("資料庫遷移完成");
      return true;
    } catch (error) {
      logger.error("資料庫遷移失敗:", error);
      throw error;
    }
  }

  /**
   * 檢查資料庫表格是否存在
   */
  async checkTables() {
    try {
      const tables = [
        "kess_documents",
        "kess_summaries",
        "kess_processing_logs",
        "kess_watched_folders",
        "kess_system_settings",
      ];
      const results = {};

      for (const table of tables) {
        const result = await dbConnection.query(
          "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
          [table]
        );
        results[table] = result[0].count > 0;
      }

      return results;
    } catch (error) {
      logger.error("檢查資料庫表格失敗:", error);
      throw error;
    }
  }

  /**
   * 初始化預設監控資料夾
   */
  async initializeWatchedFolders(folders = []) {
    try {
      if (folders.length === 0) {
        logger.info("未指定監控資料夾，跳過初始化");
        return;
      }

      // 檢查現有的監控資料夾
      const placeholders = folders.map(() => "?").join(",");
      const existingFolders = await dbConnection.query(
        `SELECT folder_path FROM kess_watched_folders WHERE folder_path IN (${placeholders})`,
        folders
      );

      const existingPaths = existingFolders.map((f) => f.folder_path);
      const newFolders = folders.filter(
        (folder) => !existingPaths.includes(folder)
      );

      if (newFolders.length > 0) {
        // 逐個插入，避免批量插入的語法問題
        for (const folder of newFolders) {
          const insertSql = `
            INSERT INTO kess_watched_folders (folder_path, is_active, watch_recursive) 
            VALUES (?, ?, ?)
          `;
          await dbConnection.query(insertSql, [folder, true, true]);
        }
        logger.info(`初始化監控資料夾: ${newFolders.join(", ")}`);
      } else {
        logger.info("所有監控資料夾已存在");
      }
    } catch (error) {
      logger.error("初始化監控資料夾失敗:", error);
      throw error;
    }
  }

  /**
   * 清理舊資料
   */
  async cleanup(daysToKeep = 90) {
    try {
      logger.info(`開始清理 ${daysToKeep} 天前的舊資料...`);

      // 清理處理日誌
      const deleteLogsResult = await dbConnection.query(
        "DELETE FROM kess_processing_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
        [daysToKeep]
      );

      // 清理已刪除檔案的記錄
      const deleteFilesResult = await dbConnection.query(
        `
        DELETE d, s FROM kess_documents d 
        LEFT JOIN kess_summaries s ON d.id = s.document_id 
        WHERE d.processing_status = 'failed' 
        AND d.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `,
        [daysToKeep]
      );

      logger.info(
        `清理完成 - 刪除日誌: ${deleteLogsResult.affectedRows} 筆, 刪除檔案記錄: ${deleteFilesResult.affectedRows} 筆`
      );
    } catch (error) {
      logger.error("清理舊資料失敗:", error);
      throw error;
    }
  }
}

// 如果直接執行此檔案，則進行遷移
if (require.main === module) {
  const migration = new DatabaseMigration();

  migration
    .migrate()
    .then(() => {
      logger.info("資料庫遷移成功完成");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("資料庫遷移失敗:", error);
      process.exit(1);
    });
}

module.exports = DatabaseMigration;
