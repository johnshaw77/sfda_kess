const CategoryService = require("./src/services/category-service");
const dbConnection = require("./src/database/connection");

async function testWatchFolders() {
  try {
    console.log("🔍 測試新的監控資料夾載入邏輯...\n");

    // 初始化資料庫連接
    await dbConnection.initialize();

    // 測試 CategoryService 的 getWatchFolders 方法
    const categoryService = new CategoryService();
    const watchFolders = await categoryService.getWatchFolders();

    console.log("✅ 成功從資料庫載入監控資料夾:");
    watchFolders.forEach((folder, index) => {
      console.log(`  ${index + 1}. ${folder}`);
    });

    console.log(`\n📊 總共 ${watchFolders.length} 個監控資料夾`);

    // 關閉資料庫連接
    await dbConnection.close();
  } catch (error) {
    console.error("❌ 測試失敗:", error);
  }
}

testWatchFolders();
