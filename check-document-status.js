const mysql = require("mysql2/promise");
const config = require("./config");

async function checkDocumentStatus() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("=== 文件處理狀態統計 ===\n");

    const [docs] = await connection.execute(`
      SELECT 
        processing_status, 
        is_archived, 
        COUNT(*) as count 
      FROM kess_documents 
      GROUP BY processing_status, is_archived
      ORDER BY processing_status, is_archived
    `);

    docs.forEach((doc) => {
      console.log(
        `狀態: ${doc.processing_status} | 歸檔: ${
          doc.is_archived ? "是" : "否"
        } | 數量: ${doc.count}`
      );
    });

    console.log("\n=== 總計 ===");
    const [total] = await connection.execute(
      "SELECT COUNT(*) as total FROM kess_documents"
    );
    console.log(`總文件數: ${total[0].total}`);

    // 檢查有摘要的文件數
    const [withSummary] = await connection.execute(`
      SELECT COUNT(DISTINCT d.id) as count 
      FROM kess_documents d 
      INNER JOIN kess_summaries s ON d.id = s.document_id
    `);
    console.log(`有摘要的文件數: ${withSummary[0].count}`);

    await connection.end();
  } catch (error) {
    console.error("檢查失敗:", error);
  }
}

checkDocumentStatus();
