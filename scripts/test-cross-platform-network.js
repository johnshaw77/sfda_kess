#!/usr/bin/env node

const path = require("path");
const config = require("../config");
const logger = require("../src/utils/logger");
const CrossPlatformNetworkMonitor = require("../src/monitor/cross-platform-network-monitor");

/**
 * 跨平台網路監控測試工具
 */
class CrossPlatformNetworkTest {
  constructor() {
    this.monitor = new CrossPlatformNetworkMonitor();
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.monitor.on("fileEvent", (eventData) => {
      console.log(`\n📁 檔案事件: ${eventData.type}`);
      console.log(`   路徑: ${eventData.path}`);
      console.log(`   檔案: ${eventData.fileName}`);
      console.log(`   大小: ${eventData.size || 'N/A'} bytes`);
      console.log(`   時間: ${eventData.timestamp}`);
      console.log(`   來源: ${eventData.originalUrl}`);
    });

    this.monitor.on("error", (error) => {
      console.error(`❌ 監控錯誤: ${error.message}`);
    });
  }

  async testBasicInfo() {
    console.log("🔍 系統資訊檢查");
    console.log(`   作業系統: ${process.platform}`);
    console.log(`   監控狀態: ${JSON.stringify(this.monitor.getStatus(), null, 2)}`);
    
    // 檢查配置
    console.log("\n⚙️  配置檢查");
    console.log(`   啟用網路監控: ${config.monitoring.enableNetworkMonitoring}`);
    console.log(`   網路路徑: ${config.monitoring.networkPaths}`);
    
    return true;
  }

  async testSmbConnection() {
    console.log("\n🔗 SMB 連線測試");
    
    if (!config.monitoring.networkPaths || config.monitoring.networkPaths.length === 0) {
      console.log("❌ 未配置網路路徑");
      return false;
    }

    const testUrl = config.monitoring.networkPaths[0];
    console.log(`   測試 URL: ${testUrl}`);

    try {
      // 解析 URL
      const match = testUrl.match(/^smb:\/\/(.+?)\\\\(.+?):(.+?)@(.+?)\/(.+?)(?:\/(.+))?$/);
      if (match) {
        const [, domain, username, password, host, share, subPath] = match;
        console.log(`   主機: ${host}`);
        console.log(`   共享: ${share}`);
        console.log(`   用戶: ${username}`);
        console.log(`   子路徑: ${subPath || '(根目錄)'}`);
      } else {
        console.log("❌ URL 格式無法解析");
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ SMB 連線測試失敗: ${error.message}`);
      return false;
    }
  }

  async testMountCommands() {
    console.log("\n🔧 掛載命令測試");
    
    const testUrl = "smb://flexium\\\\john_hsiao:qsceszK29@10.1.1.127/P-Temp/TOJohn";
    
    console.log("macOS 掛載命令:");
    console.log("   sudo mkdir -p /Volumes/kess-10-1-1-127-P-Temp");
    console.log("   sudo mount -t smbfs //john_hsiao:qsceszK29@10.1.1.127/P-Temp /Volumes/kess-10-1-1-127-P-Temp");
    
    console.log("\nLinux 掛載命令:");
    console.log("   sudo mkdir -p /mnt/kess-10-1-1-127-P-Temp");
    console.log("   sudo mount -t cifs //10.1.1.127/P-Temp /mnt/kess-10-1-1-127-P-Temp \\");
    console.log("     -o username=john_hsiao,password=qsceszK29,uid=$(id -u),gid=$(id -g),iocharset=utf8");
    
    return true;
  }

  async testNetworkMonitoring() {
    console.log("\n🎯 網路監控測試");
    
    if (!config.monitoring.enableNetworkMonitoring) {
      console.log("❌ 網路監控未啟用");
      return false;
    }

    try {
      console.log("   啟動監控器...");
      await this.monitor.startMonitoring(config.monitoring.networkPaths);
      
      console.log("✅ 監控器啟動成功");
      console.log("   狀態:", JSON.stringify(this.monitor.getStatus(), null, 2));
      
      // 等待一段時間讓用戶看到結果
      console.log("\n⏱️  監控中... (10秒後自動停止)");
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log("   停止監控器...");
      await this.monitor.stopMonitoring();
      console.log("✅ 監控器已停止");
      
      return true;
    } catch (error) {
      console.error(`❌ 網路監控測試失敗: ${error.message}`);
      return false;
    }
  }

  async runAllTests() {
    console.log("🚀 跨平台網路監控測試開始\n");
    
    const tests = [
      { name: "系統資訊", fn: this.testBasicInfo.bind(this) },
      { name: "SMB 連線", fn: this.testSmbConnection.bind(this) },
      { name: "掛載命令", fn: this.testMountCommands.bind(this) },
      { name: "網路監控", fn: this.testNetworkMonitoring.bind(this) }
    ];

    let passedTests = 0;
    
    for (const test of tests) {
      try {
        console.log(`\n📋 測試: ${test.name}`);
        const result = await test.fn();
        if (result) {
          console.log(`✅ ${test.name} 測試通過`);
          passedTests++;
        } else {
          console.log(`❌ ${test.name} 測試失敗`);
        }
      } catch (error) {
        console.error(`❌ ${test.name} 測試錯誤: ${error.message}`);
      }
    }

    console.log(`\n📊 測試結果: ${passedTests}/${tests.length} 通過`);
    
    if (passedTests === tests.length) {
      console.log("🎉 所有測試通過！");
    } else {
      console.log("⚠️  部分測試失敗，請檢查配置和網路連線");
    }
    
    return passedTests === tests.length;
  }
}

// 主程式
async function main() {
  const tester = new CrossPlatformNetworkTest();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(`💥 測試過程發生錯誤: ${error.message}`);
    process.exit(1);
  }
}

// 檢查是否直接執行
if (require.main === module) {
  main().catch(error => {
    console.error("執行失敗:", error);
    process.exit(1);
  });
}

module.exports = CrossPlatformNetworkTest;