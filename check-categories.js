const mysql = require("mysql2/promise");
const config = require("./config");

async function checkCategories() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("=== kess_categories 表資料 ===\n");

    const [categories] = await connection.execute(`
      SELECT id, category_name, category_code, watch_folder, file_pattern 
      FROM kess_categories 
      ORDER BY id
    `);

    categories.forEach((cat) => {
      console.log(`ID: ${cat.id}`);
      console.log(`名稱: ${cat.category_name}`);
      console.log(`代碼: ${cat.category_code}`);
      console.log(`監控資料夾: ${cat.watch_folder || "(未設定)"}`);
      console.log(`檔案模式: ${cat.file_pattern || "(未設定)"}`);
      console.log("---");
    });

    await connection.end();
  } catch (error) {
    console.error("檢查失敗:", error);
  }
}

checkCategories();
