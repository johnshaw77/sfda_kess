const mysql = require("mysql2/promise");
const config = require("./config");

async function checkSummaryData() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("🔍 檢查 kess_summaries 表的資料...\n");

    // 檢查摘要表結構
    const [columns] = await connection.execute(`
      DESCRIBE kess_summaries
    `);

    console.log("📋 資料表結構：");
    columns.forEach((col) => {
      console.log(
        `  ${col.Field}: ${col.Type} ${
          col.Null === "YES" ? "(可為空)" : "(不可為空)"
        }`
      );
    });

    console.log("\n📊 摘要資料統計：");

    // 檢查總記錄數
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM kess_summaries
    `);
    console.log(`總摘要數量: ${countResult[0].total}`);

    // 檢查空白欄位統計
    const [emptyStats] = await connection.execute(`
      SELECT 
        SUM(CASE WHEN summary_text IS NULL OR summary_text = '' THEN 1 ELSE 0 END) as empty_content,
        SUM(CASE WHEN key_points IS NULL OR JSON_LENGTH(key_points) = 0 THEN 1 ELSE 0 END) as empty_key_points,
        SUM(CASE WHEN keywords IS NULL OR JSON_LENGTH(keywords) = 0 THEN 1 ELSE 0 END) as empty_keywords,
        SUM(CASE WHEN entities IS NULL OR JSON_LENGTH(entities) = 0 THEN 1 ELSE 0 END) as empty_entities
      FROM kess_summaries
    `);

    console.log(`空白 summary_text: ${emptyStats[0].empty_content}`);
    console.log(`空白 key_points: ${emptyStats[0].empty_key_points}`);
    console.log(`空白 keywords: ${emptyStats[0].empty_keywords}`);
    console.log(`空白 entities: ${emptyStats[0].empty_entities}`);

    // 檢查最近的幾筆摘要資料
    const [recentSummaries] = await connection.execute(`
      SELECT 
        id,
        document_id,
        summary_text,
        key_points,
        keywords,
        entities,
        llm_provider,
        llm_model,
        created_at
      FROM kess_summaries 
      ORDER BY created_at DESC 
      LIMIT 3
    `);

    console.log("\n📝 最近的摘要資料：");
    recentSummaries.forEach((summary, index) => {
      console.log(`\n=== 摘要 ${index + 1} (ID: ${summary.id}) ===`);
      console.log(`文件ID: ${summary.document_id}`);
      console.log(`LLM: ${summary.llm_provider}/${summary.llm_model}`);
      console.log(
        `摘要內容: ${
          summary.summary_text
            ? summary.summary_text.substring(0, 100) + "..."
            : "(空白)"
        }`
      );
      console.log(
        `關鍵要點: ${
          summary.key_points ? JSON.stringify(summary.key_points) : "(空白)"
        }`
      );
      console.log(
        `關鍵字: ${
          summary.keywords ? JSON.stringify(summary.keywords) : "(空白)"
        }`
      );
      console.log(
        `實體: ${
          summary.entities ? JSON.stringify(summary.entities) : "(空白)"
        }`
      );
      console.log(`建立時間: ${summary.created_at}`);
    });

    // 檢查原始 AI 回應（如果有的話）
    const [columnsCheck] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'kess_summaries' 
      AND COLUMN_NAME = 'raw_response'
    `);

    if (columnsCheck.length > 0) {
      const [rawResponses] = await connection.execute(`
        SELECT raw_response FROM kess_summaries 
        WHERE raw_response IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT 2
      `);

      if (rawResponses.length > 0) {
        console.log("\n🤖 原始 AI 回應範例：");
        rawResponses.forEach((response, index) => {
          console.log(`\n--- AI 回應 ${index + 1} ---`);
          console.log(response.raw_response.substring(0, 500) + "...");
        });
      }
    } else {
      console.log("\n⚠️  資料表中沒有 raw_response 欄位，無法查看原始 AI 回應");
    }

    await connection.end();
  } catch (error) {
    console.error("❌ 檢查資料時發生錯誤:", error);
  }
}

checkSummaryData();
