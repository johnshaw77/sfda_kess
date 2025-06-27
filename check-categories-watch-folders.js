const mysql = require("mysql2/promise");
const config = require("./config");

async function checkCategoriesWatchFolders() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("🔍 檢查 kess_categories 的監控資料夾設定:\n");

    const [categories] = await connection.execute(`
      SELECT id, category_code, category_name, watch_folder 
      FROM kess_categories 
      WHERE is_active = TRUE
      ORDER BY sort_order
    `);

    console.log("📋 目前的分類與監控資料夾:");
    categories.forEach((cat) => {
      console.log(
        `ID: ${cat.id}, 代碼: ${cat.category_code}, 名稱: ${
          cat.category_name
        }, 監控資料夾: ${cat.watch_folder || "(未設定)"}`
      );
    });

    console.log("\n📊 監控資料夾統計:");
    const validWatchFolders = categories.filter(
      (cat) => cat.watch_folder && cat.watch_folder.trim() !== ""
    );
    console.log(`有設定監控資料夾的分類: ${validWatchFolders.length}`);
    console.log(
      `未設定監控資料夾的分類: ${categories.length - validWatchFolders.length}`
    );

    if (validWatchFolders.length > 0) {
      console.log("\n📁 有效的監控資料夾:");
      const uniqueFolders = [
        ...new Set(validWatchFolders.map((cat) => cat.watch_folder)),
      ];
      uniqueFolders.forEach((folder) => {
        console.log(`  - ${folder}`);
      });
    }

    // 檢查 kess_watched_folders 表是否還有資料
    try {
      const [watchedFolders] = await connection.execute(`
        SELECT folder_path, is_active FROM kess_watched_folders
      `);

      console.log(
        `\n📂 kess_watched_folders 表中的資料: ${watchedFolders.length} 筆`
      );
      watchedFolders.forEach((folder) => {
        console.log(
          `  - ${folder.folder_path} (${folder.is_active ? "啟用" : "停用"})`
        );
      });
    } catch (error) {
      console.log("\n⚠️  kess_watched_folders 表不存在或無法訪問");
    }

    await connection.end();
  } catch (error) {
    console.error("❌ 檢查資料時發生錯誤:", error);
  }
}

checkCategoriesWatchFolders();
