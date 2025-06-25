#!/usr/bin/env node

/**
 * 測試網路儲存監控功能
 */

const NetworkStorageMonitor = require("../src/monitor/network-storage-monitor");
const logger = require("../src/utils/logger");
const config = require("../config");

async function testNetworkStorageMonitoring() {
  let monitor = null;

  try {
    console.log("🌐 開始網路儲存監控測試...");

    // 初始化網路儲存監控器
    monitor = new NetworkStorageMonitor();

    // 設定事件監聽器
    monitor.on("networkFile", (eventData) => {
      console.log(`📁 發現檔案: ${eventData.fileInfo.fileName}`);
      console.log(`   路徑: ${eventData.filePath}`);
      console.log(
        `   大小: ${(eventData.fileInfo.fileSize / 1024).toFixed(2)} KB`
      );
      console.log(`   網路路徑: ${eventData.networkPath}`);
      console.log(`   修改時間: ${eventData.fileInfo.fileModifiedTime}`);
      console.log("");
    });

    monitor.on("error", (error) => {
      console.error(`❌ 監控錯誤: ${error.message}`);
    });

    // 從配置檔案讀取網路路徑
    const testPaths = config.monitoring.networkPaths || [];

    if (testPaths.length === 0) {
      console.log(
        "⚠️  未配置網路路徑，請檢查 .env 檔案中的 NETWORK_PATHS 設定"
      );
      return;
    }

    console.log("🔍 測試網路路徑:");
    testPaths.forEach((path) => console.log(`   - ${path}`));
    console.log("");

    // 開始監控
    await monitor.startMonitoring(testPaths);

    // 顯示狀態
    console.log("📊 監控狀態:");
    const status = monitor.getStatus();
    console.log(`   平台: ${status.platform}`);
    console.log(`   活躍狀態: ${status.isActive}`);
    console.log(`   監控路徑數量: ${status.monitoredPaths.length}`);
    console.log(`   活躍連線數: ${status.activeConnections}`);
    console.log(`   快取檔案數: ${status.cachedFiles}`);

    if (status.monitoredPaths.length > 0) {
      console.log("   監控路徑:");
      status.monitoredPaths.forEach((path) => {
        console.log(`     - ${path}`);
      });
    }
    console.log("");

    console.log("⏰ 監控中... (按 Ctrl+C 停止)");
    console.log("   - 輪詢間隔: 5 秒");
    console.log("   - 支援格式: .pdf, .docx, .doc, .txt, .md");
    console.log("");

    // 保持程式運行
    const keepAlive = () => {
      setTimeout(() => {
        if (monitor.getStatus().isActive) {
          keepAlive();
        }
      }, 1000);
    };
    keepAlive();
  } catch (error) {
    console.error(`❌ 測試失敗: ${error.message}`);
    console.error(error.stack);
  }

  // 處理程式結束
  process.on("SIGINT", async () => {
    console.log("\n🛑 收到停止信號，正在關閉監控...");
    if (monitor) {
      await monitor.stop();
    }
    console.log("✅ 監控已停止");
    process.exit(0);
  });
}

if (require.main === module) {
  testNetworkStorageMonitoring();
}

module.exports = { testNetworkStorageMonitoring };
