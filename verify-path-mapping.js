const mysql = require("mysql2/promise");
const config = require("./config");

async function verifyPathMapping() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("=== 驗證路徑對應功能 ===\n");

    // 取得品保部門資訊
    const [qaCategory] = await connection.execute(`
      SELECT * FROM kess_categories WHERE id = 2
    `);

    if (qaCategory.length > 0) {
      const qa = qaCategory[0];
      console.log(`✅ 品保部門設定:`);
      console.log(`   ID: ${qa.id}`);
      console.log(`   名稱: ${qa.category_name}`);
      console.log(`   監控資料夾: ${qa.watch_folder}`);
      console.log("");

      // 測試路徑匹配邏輯
      const testPaths = [
        "Z:\\TOJohn\\品質檢驗報告.pdf",
        "Z:\\TOJohn\\子資料夾\\測試文件.docx",
        "C:\\其他路徑\\文件.pdf",
      ];

      console.log("🧪 路徑匹配測試:");
      testPaths.forEach((path) => {
        const isMatch = path.includes(qa.watch_folder);
        console.log(`   ${isMatch ? "✅" : "❌"} ${path}`);
        if (isMatch) {
          console.log(`       → 匹配到品保部門 (${qa.watch_folder})`);
        }
      });
    } else {
      console.log("❌ 找不到品保部門設定");
    }

    await connection.end();
  } catch (error) {
    console.error("❌ 驗證失敗:", error);
  }
}

verifyPathMapping();
