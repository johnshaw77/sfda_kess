#!/usr/bin/env node

/**
 * 測試 Windows 原生網路磁碟掛載
 */

const WindowsNetworkMonitor = require("./src/monitor/windows-network-monitor");

async function testWindowsNetworkMount() {
  console.log("測試 Windows 原生網路磁碟掛載...");

  const monitor = new WindowsNetworkMonitor();

  // 設定事件監聽器
  monitor.on("fileEvent", (eventData) => {
    console.log(`檔案事件: ${eventData.type} - ${eventData.path}`);
  });

  try {
    // 測試掛載
    const networkPaths = [
      "smb://flexium\\john_hsiao:qsceszK29@10.1.1.127/P-Temp/TOJohn",
    ];

    await monitor.startMonitoring(networkPaths);

    console.log("✅ 網路磁碟掛載成功！");
    console.log("正在監控檔案變更... (按 Ctrl+C 停止)");

    // 保持運行
    process.on("SIGINT", async () => {
      console.log("\n正在清理並關閉...");
      await monitor.stopMonitoring();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ 測試失敗:", error.message);
    console.error(error.stack);
  }
}

testWindowsNetworkMount().catch(console.error);
