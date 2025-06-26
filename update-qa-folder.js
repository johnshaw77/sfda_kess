const mysql = require("mysql2/promise");
const config = require("./config");

async function updateQAWatchFolder() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("=== 更新品保部門監控資料夾 ===\n");

    // 您可以在這裡設定實際的監控路徑
    // 例如: 'Z:\\TOJohn' 或您實際使用的路徑
    const qaWatchFolder = "Z:\\TOJohn"; // 請修改為您的實際路徑

    // 更新品保部門的監控資料夾
    await connection.execute(
      `
      UPDATE kess_categories 
      SET watch_folder = ? 
      WHERE id = 2
    `,
      [qaWatchFolder]
    );

    console.log(`✅ 已更新品保部門監控資料夾為: ${qaWatchFolder}`);

    // 驗證更新結果
    const [result] = await connection.execute(`
      SELECT id, category_name, watch_folder 
      FROM kess_categories 
      WHERE id = 2
    `);

    if (result.length > 0) {
      const category = result[0];
      console.log("\n📂 更新後的設定：");
      console.log(`分類 ID: ${category.id}`);
      console.log(`分類名稱: ${category.category_name}`);
      console.log(`監控資料夾: ${category.watch_folder}`);
    }

    await connection.end();

    console.log("\n✨ 現在系統會自動將此路徑下的所有文件對應到品保部門！");
  } catch (error) {
    console.error("❌ 更新失敗:", error);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  // 您可以在命令列傳入監控路徑，例如：
  // node update-qa-folder.js "Z:\TOJohn"
  const customPath = process.argv[2];

  if (customPath) {
    // 如果有提供自訂路徑，使用自訂路徑
    updateQAWatchFolderWithPath(customPath);
  } else {
    // 否則使用預設路徑
    updateQAWatchFolder();
  }
}

async function updateQAWatchFolderWithPath(watchPath) {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log(`=== 更新品保部門監控資料夾為: ${watchPath} ===\n`);

    await connection.execute(
      `
      UPDATE kess_categories 
      SET watch_folder = ? 
      WHERE id = 2
    `,
      [watchPath]
    );

    console.log(`✅ 已更新品保部門監控資料夾為: ${watchPath}`);

    // 驗證更新結果
    const [result] = await connection.execute(`
      SELECT id, category_name, watch_folder 
      FROM kess_categories 
      WHERE id = 2
    `);

    if (result.length > 0) {
      const category = result[0];
      console.log("\n📂 更新後的設定：");
      console.log(`分類 ID: ${category.id}`);
      console.log(`分類名稱: ${category.category_name}`);
      console.log(`監控資料夾: ${category.watch_folder}`);
    }

    await connection.end();

    console.log("\n✨ 現在系統會自動將此路徑下的所有文件對應到品保部門！");
  } catch (error) {
    console.error("❌ 更新失敗:", error);
  }
}

module.exports = { updateQAWatchFolder, updateQAWatchFolderWithPath };
