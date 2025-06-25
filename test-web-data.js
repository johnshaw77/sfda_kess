const db = require("./src/database/connection");
const logger = require("./src/utils/logger");

async function testWebData() {
  try {
    // 初始化資料庫連線
    await db.initialize();

    console.log("檢查資料庫資料...");

    // 檢查分類
    const connection = await db.pool.getConnection();

    const [categories] = await connection.execute(
      "SELECT * FROM kess_categories LIMIT 5"
    );
    console.log("分類數量:", categories.length);
    if (categories.length > 0) {
      console.log("分類範例:", categories[0]);
    }

    const [documents] = await connection.execute(
      "SELECT * FROM kess_documents LIMIT 5"
    );
    console.log("文件數量:", documents.length);
    if (documents.length > 0) {
      console.log("文件範例:", documents[0]);
    }

    const [summaries] = await connection.execute(
      "SELECT * FROM kess_summaries LIMIT 5"
    );
    console.log("摘要數量:", summaries.length);
    if (summaries.length > 0) {
      console.log("摘要範例:", summaries[0]);
    }

    // 如果沒有資料，插入一些測試資料
    if (categories.length === 0) {
      console.log("插入測試分類...");
      await connection.execute(`
        INSERT INTO kess_categories (category_code, category_name, description, is_active) VALUES
        ('MFG', '製造', '製造相關文件', 1),
        ('QA', '品保', '品質保證相關文件', 1),
        ('IT', '資訊', '資訊技術相關文件', 1)
      `);
    }

    if (documents.length === 0) {
      console.log("插入測試文件...");
      await connection.execute(`
        INSERT INTO kess_documents (
          category_id, file_path, original_path, file_name, file_extension, 
          file_size, file_hash, file_modified_time, content_preview, word_count, 
          processing_status, created_at, updated_at
        ) VALUES
        (1, './demo-data/生產計劃_2025Q1.md', './demo-data/生產計劃_2025Q1.md', '生產計劃_2025Q1.md', '.md', 
         1024, 'abc123def456', NOW(), '這是一個生產計劃文件的預覽內容...', 150, 'completed', NOW(), NOW()),
        (2, './demo-data/品質檢驗報告_SMS-2025-001.md', './demo-data/品質檢驗報告_SMS-2025-001.md', '品質檢驗報告_SMS-2025-001.md', '.md',
         2048, 'def456ghi789', NOW(), '這是一個品質檢驗報告的預覽內容...', 300, 'completed', NOW(), NOW()),
        (3, './demo-data/word測試文件.md', './demo-data/word測試文件.md', 'word測試文件.md', '.md',
         512, 'ghi789jkl012', NOW(), '這是一個測試文件的預覽內容...', 80, 'pending', NOW(), NOW())
      `);

      console.log("插入測試摘要...");
      await connection.execute(`
        INSERT INTO kess_summaries (
          document_id, summary_text, keywords, entities, key_points, 
          confidence, model_used, processing_time, created_at, updated_at
        ) VALUES
        (1, '這是生產計劃的摘要內容，包含了2025年第一季的生產安排和目標。', '生產,計劃,2025Q1', '製造部,生產線', '季度目標,產能規劃', 0.92, 'qwen2.5:14b', 1500, NOW(), NOW()),
        (2, '這是品質檢驗報告的摘要，詳細說明了SMS-2025-001的檢驗結果和品質狀況。', '品質,檢驗,報告', 'SMS部門,檢驗員', '合格率,改善建議', 0.88, 'qwen2.5:14b', 1800, NOW(), NOW())
      `);
    }

    connection.release();
    console.log("測試資料準備完成！");
  } catch (error) {
    console.error("測試資料準備失敗:", error);
  } finally {
    process.exit(0);
  }
}

testWebData();
