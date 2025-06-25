#!/usr/bin/env node

/**
 * KESS 資料庫連接測試和遷移腳本
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// 資料庫配置
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  timezone: "+08:00",
};

console.log("=== KESS 資料庫測試和遷移工具 ===\n");

/**
 * 測試資料庫連接
 */
async function testConnection() {
  console.log("📡 測試資料庫連接...");
  console.log(`   主機: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   資料庫: ${dbConfig.database}`);
  console.log(`   使用者: ${dbConfig.user}`);
  console.log("");

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 測試基本查詢
    const [results] = await connection.execute("SELECT VERSION() as version");
    console.log("✅ 資料庫連接成功!");
    console.log(`   MySQL 版本: ${results[0].version}`);

    // 測試時間查詢
    try {
      const [timeResults] = await connection.execute(
        "SELECT NOW() as current_time"
      );
      console.log(`   服務器時間: ${timeResults[0].current_time}`);
    } catch (timeError) {
      console.log(`   時間查詢失敗: ${timeError.message}`);
    }
    console.log("");

    await connection.end();
    return true;
  } catch (error) {
    console.log("❌ 資料庫連接失敗!");
    console.log(`   錯誤: ${error.message}`);
    console.log(`   錯誤代碼: ${error.code || "N/A"}`);
    console.log(`   SQL 狀態: ${error.sqlState || "N/A"}`);
    console.log("");
    return false;
  }
}

/**
 * 檢查現有表格
 */
async function checkExistingTables() {
  console.log("🔍 檢查現有表格...");

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 查詢現有的 KESS 表格
    const [tables] = await connection.execute(
      `
      SELECT table_name, table_comment, table_rows 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name LIKE 'kess_%'
      ORDER BY table_name
    `,
      [dbConfig.database]
    );

    if (tables.length === 0) {
      console.log("   📝 未找到任何 KESS 表格，需要執行遷移");
    } else {
      console.log(`   📊 找到 ${tables.length} 個 KESS 表格:`);
      tables.forEach((table) => {
        console.log(
          `     - ${table.table_name} (${table.table_rows} 行) - ${
            table.table_comment || "無描述"
          }`
        );
      });
    }
    console.log("");

    await connection.end();
    return tables;
  } catch (error) {
    console.log(`   ❌ 檢查表格失敗: ${error.message}`);
    console.log("");
    return [];
  }
}

/**
 * 執行資料庫遷移
 */
async function runMigration() {
  console.log("🚀 執行資料庫遷移...");

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 設定字元集
    await connection.execute("SET NAMES utf8mb4");
    await connection.execute("SET CHARACTER SET utf8mb4");
    await connection.execute("SET character_set_connection=utf8mb4");
    console.log("   ✅ 已設定資料庫字元集為 utf8mb4");

    // 讀取 SQL 檔案
    const sqlPath = path.join(
      __dirname,
      "src",
      "database",
      "migrations",
      "init.sql"
    );
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`找不到 SQL 檔案: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8");
    console.log("   📖 已讀取遷移 SQL 檔案");

    // 分割 SQL 語句
    const statements = sqlContent
      .replace(/--.*$/gm, "") // 移除註解
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    console.log(`   📝 準備執行 ${statements.length} 個 SQL 語句`);

    // 執行每個語句
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.length === 0) continue;

      try {
        await connection.execute(statement);
        successCount++;

        // 顯示執行進度
        if (statement.toUpperCase().includes("CREATE TABLE")) {
          const match = statement.match(
            /CREATE TABLE.*?(?:IF NOT EXISTS\s+)?`?(\w+)`?/i
          );
          if (match) {
            console.log(`   ✅ 已建立表格: ${match[1]}`);
          }
        } else if (statement.toUpperCase().includes("INSERT INTO")) {
          const match = statement.match(/INSERT INTO.*?`?(\w+)`?/i);
          if (match && !statement.includes("ON DUPLICATE")) {
            console.log(`   ✅ 已插入預設資料: ${match[1]}`);
          }
        } else if (statement.toUpperCase().includes("CREATE OR REPLACE VIEW")) {
          const match = statement.match(/CREATE OR REPLACE VIEW.*?`?(\w+)`?/i);
          if (match) {
            console.log(`   ✅ 已建立視圖: ${match[1]}`);
          }
        }
      } catch (error) {
        errorCount++;

        // 某些錯誤可以忽略
        if (
          error.code === "ER_TABLE_EXISTS_ERROR" ||
          (error.code === "ER_DUP_ENTRY" &&
            statement.toUpperCase().includes("INSERT"))
        ) {
          console.log(
            `   ⚠️  忽略錯誤 (${error.code}): ${statement.substring(0, 50)}...`
          );
          successCount++;
          errorCount--;
        } else {
          console.log(`   ❌ 執行失敗: ${statement.substring(0, 50)}...`);
          console.log(`      錯誤 (${error.code}): ${error.message}`);
        }
      }
    }

    console.log(`   📊 遷移完成: ${successCount} 成功, ${errorCount} 失敗`);
    console.log("");

    await connection.end();
    return errorCount === 0;
  } catch (error) {
    console.log(`   ❌ 遷移失敗: ${error.message}`);
    console.log("");
    return false;
  }
}

/**
 * 驗證遷移結果
 */
async function validateMigration() {
  console.log("✅ 驗證遷移結果...");

  const requiredTables = [
    "kess_categories",
    "kess_documents",
    "kess_summaries",
    "kess_processing_logs",
    "kess_watched_folders",
    "kess_system_settings",
  ];

  try {
    const connection = await mysql.createConnection(dbConfig);

    let allTablesExist = true;
    let categoryCount = 0;
    let settingCount = 0;

    for (const tableName of requiredTables) {
      const [tables] = await connection.execute(
        `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?
      `,
        [dbConfig.database, tableName]
      );

      if (tables[0].count > 0) {
        console.log(`   ✅ ${tableName}`);

        // 檢查預設資料
        if (tableName === "kess_categories") {
          const [categories] = await connection.execute(
            "SELECT COUNT(*) as count FROM kess_categories"
          );
          categoryCount = categories[0].count;
        } else if (tableName === "kess_system_settings") {
          const [settings] = await connection.execute(
            "SELECT COUNT(*) as count FROM kess_system_settings"
          );
          settingCount = settings[0].count;
        }
      } else {
        console.log(`   ❌ ${tableName} (缺少)`);
        allTablesExist = false;
      }
    }

    console.log("");
    console.log(`   📊 預設資料統計:`);
    console.log(`      - 功能類別: ${categoryCount} 筆`);
    console.log(`      - 系統設定: ${settingCount} 筆`);
    console.log("");

    await connection.end();
    return allTablesExist;
  } catch (error) {
    console.log(`   ❌ 驗證失敗: ${error.message}`);
    console.log("");
    return false;
  }
}

/**
 * 主函數
 */
async function main() {
  try {
    // 1. 測試連接
    const connectionOk = await testConnection();
    if (!connectionOk) {
      console.log("🛑 請檢查資料庫設定後重試");
      process.exit(1);
    }

    // 2. 檢查現有表格
    const existingTables = await checkExistingTables();

    // 3. 決定是否需要遷移
    if (existingTables.length === 0) {
      console.log("🔧 開始建立資料庫表格...");
      const migrationOk = await runMigration();

      if (migrationOk) {
        console.log("✅ 資料庫遷移成功！");
      } else {
        console.log("❌ 資料庫遷移部分失敗，請檢查錯誤訊息");
      }
    } else {
      console.log("ℹ️  資料庫表格已存在，跳過遷移");
    }

    // 4. 驗證結果
    const validationOk = await validateMigration();

    if (validationOk) {
      console.log("🎉 資料庫準備完成，系統可以正常運行！");
    } else {
      console.log("⚠️  資料庫驗證有問題，請檢查遷移結果");
    }
  } catch (error) {
    console.error("💥 執行過程中發生錯誤:", error);
    process.exit(1);
  }
}

// 如果直接執行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testConnection,
  checkExistingTables,
  runMigration,
  validateMigration,
  main,
};
