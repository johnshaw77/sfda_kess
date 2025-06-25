const mysql = require("mysql2/promise");
const config = require("../config");
const logger = require("../src/utils/logger");
const fs = require("fs").promises;
const path = require("path");

/**
 * 測試中文資料插入和查詢功能
 */
async function testChineseData() {
  let connection;

  try {
    logger.info("開始測試中文資料處理功能...");

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

    // 測試中文文件資料插入
    logger.info("插入測試文件資料...");

    const testDocuments = [
      {
        file_name: "生產計劃_2025Q1.md",
        file_path: "./demo-data/生產計劃_2025Q1.md",
        original_path: "./demo-data/生產計劃_2025Q1.md",
        file_extension: ".md",
        file_size: 772,
        file_hash: "test_hash_1",
        file_modified_time: new Date(),
        category_id: 1, // MFG 製造部門
        content_preview:
          "本文件包含2025年第一季的詳細生產計劃，涵蓋智慧型手機外殼、筆記型電腦鍵盤等產品的生產安排。",
        word_count: 150,
      },
      {
        file_name: "品質檢驗報告_SMS-2025-001.md",
        file_path: "./demo-data/品質檢驗報告_SMS-2025-001.md",
        original_path: "./demo-data/品質檢驗報告_SMS-2025-001.md",
        file_extension: ".md",
        file_size: 1159,
        file_hash: "test_hash_2",
        file_modified_time: new Date(),
        category_id: 2, // QA 品保部門
        content_preview:
          "本報告詳細記錄了智慧型手機外殼的品質檢驗結果，包含外觀檢查、功能測試、材料檢測等項目。",
        word_count: 200,
      },
    ];

    for (const doc of testDocuments) {
      const [result] = await connection.execute(
        `INSERT INTO kess_documents (
          file_name, file_path, original_path, file_extension, file_size, file_hash,
          file_modified_time, category_id, content_preview, word_count, processing_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doc.file_name,
          doc.file_path,
          doc.original_path,
          doc.file_extension,
          doc.file_size,
          doc.file_hash,
          doc.file_modified_time,
          doc.category_id,
          doc.content_preview,
          doc.word_count,
          "completed",
        ]
      );
      logger.info(`文件插入成功，ID: ${result.insertId}`);
    }

    // 測試中文摘要資料插入
    logger.info("插入測試摘要資料...");

    const testSummaries = [
      {
        document_id: 1,
        summary_text:
          "此文件為2025年第一季生產計劃，主要規劃智慧型手機外殼、筆記型電腦鍵盤、工業控制器組件的生產。設定品質目標為不良率控制在0.5%以下，產量目標為智慧型手機外殼50,000件，準時交貨率達98%以上。同時制定了設備維護計劃和人力配置安排。",
        key_points: JSON.stringify([
          "生產計劃",
          "品質目標",
          "產量目標",
          "設備維護",
          "人力配置",
        ]),
        keywords: JSON.stringify([
          "生產計劃",
          "智慧型手機外殼",
          "品質目標",
          "設備維護",
          "人力配置",
        ]),
        entities: JSON.stringify([
          "2025年第一季",
          "智慧型手機外殼",
          "筆記型電腦鍵盤",
          "工業控制器組件",
        ]),
        llm_provider: "manual_test",
        llm_model: "test_model_v1.0",
        processing_time_ms: 2500,
        token_usage: JSON.stringify({ input_tokens: 150, output_tokens: 120 }),
        confidence_score: 0.9,
      },
      {
        document_id: 2,
        summary_text:
          "此為智慧型手機外殼品質檢驗報告（批次SMS-2025-001），檢驗日期為2025-06-22。檢驗項目包含外觀檢查、功能測試、材料檢測。檢驗結果顯示表面光潔度符合標準、尺寸精度在公差範圍內、功能測試正常。本批次檢驗1000件，發現3件不良品，不良率0.3%，符合小於0.5%的標準。",
        key_points: JSON.stringify([
          "品質檢驗",
          "外觀檢查",
          "功能測試",
          "材料檢測",
          "不良率分析",
        ]),
        keywords: JSON.stringify([
          "品質檢驗",
          "智慧型手機外殼",
          "外觀檢查",
          "功能測試",
          "不良率",
        ]),
        entities: JSON.stringify([
          "SMS-2025-001",
          "2025-06-22",
          "智慧型手機外殼",
          "品質檢驗報告",
        ]),
        llm_provider: "manual_test",
        llm_model: "test_model_v1.0",
        processing_time_ms: 3200,
        token_usage: JSON.stringify({ input_tokens: 200, output_tokens: 135 }),
        confidence_score: 0.95,
      },
    ];

    for (const summary of testSummaries) {
      const [result] = await connection.execute(
        `INSERT INTO kess_summaries (
          document_id, summary_text, key_points, keywords, entities,
          llm_provider, llm_model, processing_time_ms, token_usage, confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summary.document_id,
          summary.summary_text,
          summary.key_points,
          summary.keywords,
          summary.entities,
          summary.llm_provider,
          summary.llm_model,
          summary.processing_time_ms,
          summary.token_usage,
          summary.confidence_score,
        ]
      );
      logger.info(`摘要插入成功，ID: ${result.insertId}`);
    }

    // 測試處理日誌
    logger.info("插入測試處理日誌...");

    await connection.execute(
      `INSERT INTO kess_processing_logs (
        document_id, log_level, log_message, log_details, processing_stage, execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        1,
        "info",
        "中文文件處理完成",
        JSON.stringify({
          stage: "完成",
          file_size: 772,
          processing_time: "2.5秒",
          language_detected: "繁體中文",
        }),
        "document_processing",
        2500,
      ]
    );

    await connection.execute(
      `INSERT INTO kess_processing_logs (
        document_id, log_level, log_message, log_details, processing_stage, execution_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        2,
        "info",
        "中文摘要生成完成",
        JSON.stringify({
          stage: "摘要完成",
          summary_length: 135,
          keywords_extracted: 5,
          confidence: "高",
        }),
        "summary_generation",
        3200,
      ]
    );

    // 測試查詢功能
    logger.info("測試中文資料查詢...");

    console.log("\n=== 文件資料查詢結果 ===");
    const [documents] = await connection.execute(`
      SELECT d.id, d.file_name, d.content_preview, c.category_name
      FROM kess_documents d
      JOIN kess_categories c ON d.category_id = c.id
      ORDER BY d.id
    `);

    for (const doc of documents) {
      console.log(`ID: ${doc.id}`);
      console.log(`檔案名稱: ${doc.file_name}`);
      console.log(`類別: ${doc.category_name}`);
      console.log(`內容預覽: ${doc.content_preview}`);
      console.log("---");
    }

    console.log("\n=== 摘要資料查詢結果 ===");
    const [summaries] = await connection.execute(`
      SELECT s.id, d.file_name, s.summary_text, s.keywords, s.llm_provider
      FROM kess_summaries s
      JOIN kess_documents d ON s.document_id = d.id
      ORDER BY s.id
    `);

    for (const summary of summaries) {
      console.log(`摘要ID: ${summary.id}`);
      console.log(`檔案: ${summary.file_name}`);
      console.log(`LLM提供者: ${summary.llm_provider}`);
      console.log(`關鍵字: ${summary.keywords}`);
      console.log(`摘要: ${summary.summary_text}`);
      console.log("---");
    }

    console.log("\n=== 處理日誌查詢結果 ===");
    const [logs] = await connection.execute(`
      SELECT l.document_id, d.file_name, l.log_level, l.log_message, l.log_details, l.processing_stage, l.created_at
      FROM kess_processing_logs l
      LEFT JOIN kess_documents d ON l.document_id = d.id
      ORDER BY l.created_at DESC
      LIMIT 5
    `);

    for (const log of logs) {
      console.log(`時間: ${log.created_at}`);
      console.log(`檔案: ${log.file_name || "未知"}`);
      console.log(`階段: ${log.processing_stage}`);
      console.log(`等級: ${log.log_level}`);
      console.log(`訊息: ${log.log_message}`);
      console.log(`詳細: ${log.log_details}`);
      console.log("---");
    }

    // 測試統計視圖
    console.log("\n=== 統計資料查詢結果 ===");
    const [stats] = await connection.execute(`
      SELECT 
        category_name as 類別名稱,
        document_count as 文件數量,
        total_size_mb as 總大小MB,
        avg_confidence as 平均信心度
      FROM kess_category_statistics
      WHERE document_count > 0
    `);

    for (const stat of stats) {
      console.log(`類別: ${stat.類別名稱}`);
      console.log(`文件數量: ${stat.文件數量}`);
      console.log(`總大小: ${stat.總大小MB} MB`);
      console.log(`平均信心度: ${stat.平均信心度}`);
      console.log("---");
    }

    logger.info("中文資料處理測試完成！");
  } catch (error) {
    logger.error("測試中文資料處理時發生錯誤:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  testChineseData()
    .then(() => {
      console.log("中文資料處理測試成功完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("測試失敗:", error);
      process.exit(1);
    });
}

module.exports = { testChineseData };
