#!/usr/bin/env node

/**
 * 簡化的資料庫設置腳本
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

async function setupDatabase() {
  console.log("開始設置資料庫...");

  try {
    // 連接資料庫
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: "utf8mb4",
    });

    console.log("✅ 資料庫連接成功");

    // 設定字元集
    await connection.execute("SET NAMES utf8mb4");
    console.log("✅ 已設定字元集");

    // 建立 kess_categories 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category_code VARCHAR(20) NOT NULL COMMENT '功能代碼',
        category_name VARCHAR(50) NOT NULL COMMENT '功能名稱',
        description TEXT COMMENT '功能描述',
        watch_folder VARCHAR(500) COMMENT '監控資料夾路徑',
        archive_folder VARCHAR(500) COMMENT '歸檔資料夾路徑',
        file_pattern VARCHAR(200) COMMENT '檔案命名模式',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
        sort_order INT DEFAULT 0 COMMENT '排序順序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
        UNIQUE KEY uk_category_code (category_code),
        INDEX idx_is_active (is_active),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='功能類別管理表'
    `);
    console.log("✅ 已建立 kess_categories 表");

    // 建立 kess_documents 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category_id INT NOT NULL COMMENT '功能類別 ID',
        file_path VARCHAR(500) NOT NULL COMMENT '檔案路徑',
        original_path VARCHAR(500) NOT NULL COMMENT '原始檔案路徑',
        archive_path VARCHAR(500) COMMENT '歸檔路徑',
        file_name VARCHAR(255) NOT NULL COMMENT '檔案名稱',
        file_extension VARCHAR(10) COMMENT '檔案副檔名',
        file_size BIGINT COMMENT '檔案大小（位元組）',
        file_hash VARCHAR(64) COMMENT '檔案雜湊值（SHA-256）',
        file_modified_time DATETIME COMMENT '檔案修改時間',
        content_preview TEXT COMMENT '內容預覽（前500字）',
        word_count INT DEFAULT 0 COMMENT '字數統計',
        processing_status ENUM('pending', 'processing', 'completed', 'failed', 'archived', 'deleted') DEFAULT 'pending' COMMENT '處理狀態',
        is_archived BOOLEAN DEFAULT FALSE COMMENT '是否已歸檔',
        archived_at DATETIME NULL COMMENT '歸檔時間',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
        INDEX idx_category_id (category_id),
        INDEX idx_file_path (file_path),
        INDEX idx_file_hash (file_hash),
        INDEX idx_processing_status (processing_status),
        INDEX idx_is_archived (is_archived),
        INDEX idx_created_at (created_at),
        UNIQUE KEY uk_file_path_hash (file_path, file_hash),
        FOREIGN KEY (category_id) REFERENCES kess_categories(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件記錄表'
    `);
    console.log("✅ 已建立 kess_documents 表");

    // 建立其他表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_summaries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '文件 ID',
        summary_text TEXT NOT NULL COMMENT '摘要內容',
        key_points JSON COMMENT '關鍵要點（JSON 格式）',
        keywords JSON COMMENT '關鍵字（JSON 格式）',
        entities JSON COMMENT '實體識別結果（JSON 格式）',
        llm_provider VARCHAR(50) NOT NULL COMMENT 'LLM 提供者',
        llm_model VARCHAR(100) NOT NULL COMMENT 'LLM 模型名稱',
        processing_time_ms INT COMMENT '處理時間（毫秒）',
        token_usage JSON COMMENT 'Token 使用量（JSON 格式）',
        confidence_score DECIMAL(3,2) COMMENT '可信度分數（0-1）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
        INDEX idx_document_id (document_id),
        INDEX idx_created_at (created_at),
        INDEX idx_llm_provider (llm_provider),
        FOREIGN KEY (document_id) REFERENCES kess_documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='摘要結果表'
    `);
    console.log("✅ 已建立 kess_summaries 表");

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_processing_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT COMMENT '文件 ID（可為空，用於系統級日誌）',
        log_level ENUM('debug', 'info', 'warn', 'error') NOT NULL COMMENT '日誌等級',
        log_message TEXT NOT NULL COMMENT '日誌訊息',
        log_details JSON COMMENT '詳細資訊（JSON 格式）',
        error_stack TEXT COMMENT '錯誤堆疊（如果有錯誤）',
        processing_stage VARCHAR(50) COMMENT '處理階段',
        execution_time_ms INT COMMENT '執行時間（毫秒）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        INDEX idx_document_id (document_id),
        INDEX idx_log_level (log_level),
        INDEX idx_created_at (created_at),
        INDEX idx_processing_stage (processing_stage),
        FOREIGN KEY (document_id) REFERENCES kess_documents(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='處理日誌表'
    `);
    console.log("✅ 已建立 kess_processing_logs 表");

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_watched_folders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        folder_path VARCHAR(500) NOT NULL COMMENT '監控資料夾路徑',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用監控',
        watch_recursive BOOLEAN DEFAULT TRUE COMMENT '是否遞迴監控子資料夾',
        file_pattern VARCHAR(200) COMMENT '檔案匹配模式（正規表達式）',
        exclude_pattern VARCHAR(200) COMMENT '排除模式（正規表達式）',
        last_scan_time TIMESTAMP NULL COMMENT '最後掃描時間',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
        INDEX idx_is_active (is_active),
        INDEX idx_last_scan_time (last_scan_time),
        UNIQUE KEY uk_folder_path (folder_path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='監控資料夾設定表'
    `);
    console.log("✅ 已建立 kess_watched_folders 表");

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kess_system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL COMMENT '設定鍵值',
        setting_value TEXT COMMENT '設定值',
        setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '設定類型',
        description TEXT COMMENT '設定描述',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
        UNIQUE KEY uk_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系統設定表'
    `);
    console.log("✅ 已建立 kess_system_settings 表");

    // 插入預設類別資料
    const categories = [
      [
        "MFG",
        "製造部門",
        "製造相關文件，包含生產計劃、工藝文件、設備維護等",
        "./watch/manufacturing",
        "./archive/manufacturing",
        1,
      ],
      [
        "QA",
        "品保部門",
        "品質保證相關文件，包含檢驗報告、品質標準、不良分析等",
        "./watch/quality",
        "./archive/quality",
        2,
      ],
      [
        "IT",
        "資訊部門",
        "資訊技術相關文件，包含系統文檔、技術規範、維護記錄等",
        "./watch/it",
        "./archive/it",
        3,
      ],
      [
        "HR",
        "人資部門",
        "人力資源相關文件，包含招聘、培訓、績效評估等",
        "./watch/hr",
        "./archive/hr",
        4,
      ],
      [
        "FIN",
        "財務部門",
        "財務相關文件，包含報表、預算、採購、會計等",
        "./watch/finance",
        "./archive/finance",
        5,
      ],
      [
        "R&D",
        "研發部門",
        "研發相關文件，包含產品設計、技術研究、專利等",
        "./watch/rnd",
        "./archive/rnd",
        6,
      ],
      [
        "ADMIN",
        "行政部門",
        "行政管理相關文件，包含公告、政策、會議記錄等",
        "./watch/admin",
        "./archive/admin",
        7,
      ],
      [
        "GENERAL",
        "通用類別",
        "未分類或通用文件",
        "./watch/general",
        "./archive/general",
        99,
      ],
    ];

    for (const category of categories) {
      try {
        await connection.execute(
          `
          INSERT INTO kess_categories (category_code, category_name, description, watch_folder, archive_folder, sort_order) 
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `,
          category
        );
      } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
          console.log(
            `   警告：插入類別 ${category[0]} 時發生錯誤: ${error.message}`
          );
        }
      }
    }
    console.log("✅ 已插入預設類別資料");

    // 插入系統設定
    const settings = [
      ["system_version", "1.0.0", "string", "系統版本"],
      ["auto_process_enabled", "true", "boolean", "是否啟用自動處理"],
      ["max_concurrent_jobs", "5", "number", "最大並發處理任務數"],
      ["default_summary_language", "zh-TW", "string", "預設摘要語言"],
    ];

    for (const setting of settings) {
      try {
        await connection.execute(
          `
          INSERT INTO kess_system_settings (setting_key, setting_value, setting_type, description) 
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `,
          setting
        );
      } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
          console.log(
            `   警告：插入設定 ${setting[0]} 時發生錯誤: ${error.message}`
          );
        }
      }
    }
    console.log("✅ 已插入預設系統設定");

    // 驗證表格
    const [tables] = await connection.execute(
      `
      SELECT table_name, table_rows 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name LIKE 'kess_%'
    `,
      [process.env.DB_NAME]
    );

    console.log("");
    console.log("📊 已建立的表格:");
    tables.forEach((table) => {
      console.log(`   - ${table.table_name} (${table.table_rows} 行)`);
    });

    // 檢查類別資料
    const [categoryCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM kess_categories"
    );
    console.log(`✅ 類別資料: ${categoryCount[0].count} 筆`);

    await connection.end();
    console.log("");
    console.log("🎉 資料庫設置完成！系統可以正常運行。");
  } catch (error) {
    console.error("❌ 資料庫設置失敗:", error.message);
    console.error("錯誤代碼:", error.code);
    process.exit(1);
  }
}

setupDatabase().catch(console.error);
