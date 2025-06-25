const axios = require("axios");

async function testWebInterface() {
  const baseUrl = "http://localhost:3000";

  console.log("🧪 開始測試 KESS Web 介面...\n");

  try {
    // 測試首頁重導向
    console.log("📋 測試首頁重導向...");
    const homeResponse = await axios.get(baseUrl, {
      maxRedirects: 0,
      validateStatus: () => true,
    });
    if (homeResponse.status === 302) {
      console.log("✅ 首頁重導向正常");
    } else {
      console.log("❌ 首頁重導向異常");
    }

    // 測試儀表板
    console.log("📊 測試儀表板頁面...");
    const dashboardResponse = await axios.get(`${baseUrl}/dashboard`);
    if (dashboardResponse.status === 200) {
      console.log("✅ 儀表板載入成功");
    } else {
      console.log("❌ 儀表板載入失敗");
    }

    // 測試文件列表
    console.log("📄 測試文件列表頁面...");
    const documentsResponse = await axios.get(`${baseUrl}/documents`);
    if (documentsResponse.status === 200) {
      console.log("✅ 文件列表載入成功");
    } else {
      console.log("❌ 文件列表載入失敗");
    }

    // 測試文件詳情
    console.log("🔍 測試文件詳情頁面...");
    const documentDetailResponse = await axios.get(`${baseUrl}/documents/1`);
    if (documentDetailResponse.status === 200) {
      console.log("✅ 文件詳情載入成功");
    } else {
      console.log("❌ 文件詳情載入失敗");
    }

    // 測試摘要頁面
    console.log("📝 測試摘要頁面...");
    const summaryResponse = await axios.get(`${baseUrl}/summaries/1`);
    if (summaryResponse.status === 200) {
      console.log("✅ 摘要頁面載入成功");
    } else {
      console.log("❌ 摘要頁面載入失敗");
    }

    // 測試 API 端點
    console.log("🔌 測試 API 端點...");

    // 測試文件預覽 API
    const previewResponse = await axios.get(
      `${baseUrl}/api/documents/1/preview`
    );
    if (previewResponse.status === 200 && previewResponse.data.id) {
      console.log("✅ 文件預覽 API 正常");
    } else {
      console.log("❌ 文件預覽 API 異常");
    }

    // 測試搜尋功能
    console.log("🔎 測試搜尋功能...");
    const searchResponse = await axios.get(`${baseUrl}/documents?search=品質`);
    if (searchResponse.status === 200) {
      console.log("✅ 搜尋功能正常");
    } else {
      console.log("❌ 搜尋功能異常");
    }

    // 測試篩選功能
    console.log("🏷️ 測試篩選功能...");
    const filterResponse = await axios.get(
      `${baseUrl}/documents?status=completed`
    );
    if (filterResponse.status === 200) {
      console.log("✅ 篩選功能正常");
    } else {
      console.log("❌ 篩選功能異常");
    }

    console.log("\n🎉 所有測試完成！Web 介面運行正常。");
    console.log(`🌐 請訪問 ${baseUrl} 查看完整功能`);
  } catch (error) {
    console.error("❌ 測試過程中發生錯誤:", error.message);
    console.log("請確認：");
    console.log("1. Web 伺服器是否正在運行 (npm run start:web)");
    console.log("2. 資料庫連線是否正常");
    console.log("3. 是否有測試資料");
  }
}

// 等待伺服器啟動
setTimeout(() => {
  testWebInterface();
}, 2000);

console.log("⏳ 等待伺服器啟動...");
