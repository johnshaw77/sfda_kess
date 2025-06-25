const path = require("path");
const fs = require("fs-extra");
require("dotenv").config();

const WindowsNetworkMonitor = require("../src/monitor/windows-network-monitor");
const logger = require("../src/utils/logger");
const config = require("../config");

/**
 * Windows 網路監控功能測試腳本
 * 用於測試 SMB 掛載和檔案監控功能
 */
class WindowsNetworkTester {
  constructor() {
    this.monitor = null;
    this.testResults = {
      mount: false,
      watch: false,
      fileDetection: false,
      unmount: false,
    };
  }

  /**
   * 執行完整測試
   */
  async runTests() {
    try {
      logger.info("開始 Windows 網路監控測試...");

      if (process.platform !== "win32") {
        logger.error("此測試僅適用於 Windows 環境");
        return false;
      }

      // 檢查配置
      if (
        !config.monitoring.networkPaths ||
        config.monitoring.networkPaths.length === 0
      ) {
        logger.error("未配置網路路徑，請檢查 .env 檔案中的 NETWORK_PATHS 設定");
        return false;
      }

      this.monitor = new WindowsNetworkMonitor();

      // 設定事件監聽
      this.setupEventListeners();

      // 測試掛載和監控
      await this.testMountAndWatch();

      // 等待一段時間讓監控器穩定
      await this.wait(5000);

      // 測試檔案偵測（如果有需要）
      await this.testFileDetection();

      // 測試卸載
      await this.testUnmount();

      // 顯示測試結果
      this.showResults();

      return this.allTestsPassed();
    } catch (error) {
      logger.logError("測試過程發生錯誤", error);
      return false;
    }
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    this.monitor.on("fileEvent", (eventData) => {
      logger.info(`[FILE_EVENT] ${eventData.type}: ${eventData.path}`);
      this.testResults.fileDetection = true;
    });

    this.monitor.on("error", (error) => {
      logger.logError("監控器錯誤", error);
    });
  }

  /**
   * 測試掛載和監控
   */
  async testMountAndWatch() {
    try {
      logger.info("測試 SMB 掛載和監控...");

      await this.monitor.startMonitoring(config.monitoring.networkPaths);

      this.testResults.mount = true;
      this.testResults.watch = true;

      logger.info("✓ SMB 掛載和監控測試通過");
    } catch (error) {
      logger.logError("✗ SMB 掛載和監控測試失敗", error);
      throw error;
    }
  }

  /**
   * 測試檔案偵測
   */
  async testFileDetection() {
    try {
      logger.info("測試檔案偵測功能...");

      // 這個測試需要手動在網路資料夾中建立/修改檔案
      // 或者可以程式化建立測試檔案

      const mountedPaths = Array.from(this.monitor.mountedDrives.values());
      if (mountedPaths.length > 0) {
        const testPath = mountedPaths[0].mountPath;
        const testFilePath = path.join(testPath, `test_${Date.now()}.txt`);

        try {
          // 嘗試建立測試檔案
          await fs.writeFile(
            testFilePath,
            `測試檔案建立於 ${new Date().toISOString()}`
          );
          logger.info(`建立測試檔案: ${testFilePath}`);

          // 等待事件觸發
          await this.wait(3000);

          // 刪除測試檔案
          await fs.remove(testFilePath);
          logger.info(`刪除測試檔案: ${testFilePath}`);

          // 等待刪除事件觸發
          await this.wait(2000);
        } catch (fileError) {
          logger.warn(`無法建立測試檔案: ${fileError.message}`);
          logger.info("請手動在網路資料夾中建立/修改檔案以測試檔案偵測功能");
        }
      }

      if (this.testResults.fileDetection) {
        logger.info("✓ 檔案偵測測試通過");
      } else {
        logger.warn("? 檔案偵測測試未觸發（需要手動測試）");
      }
    } catch (error) {
      logger.logError("檔案偵測測試發生錯誤", error);
    }
  }

  /**
   * 測試卸載
   */
  async testUnmount() {
    try {
      logger.info("測試 SMB 卸載...");

      await this.monitor.stopMonitoring();

      this.testResults.unmount = true;
      logger.info("✓ SMB 卸載測試通過");
    } catch (error) {
      logger.logError("✗ SMB 卸載測試失敗", error);
    }
  }

  /**
   * 顯示測試結果
   */
  showResults() {
    logger.info("\n========== 測試結果 ==========");
    logger.info(`SMB 掛載: ${this.testResults.mount ? "✓ 通過" : "✗ 失敗"}`);
    logger.info(`檔案監控: ${this.testResults.watch ? "✓ 通過" : "✗ 失敗"}`);
    logger.info(
      `檔案偵測: ${this.testResults.fileDetection ? "✓ 通過" : "? 未觸發"}`
    );
    logger.info(`SMB 卸載: ${this.testResults.unmount ? "✓ 通過" : "✗ 失敗"}`);
    logger.info("===============================\n");
  }

  /**
   * 檢查所有測試是否通過
   */
  allTestsPassed() {
    return (
      this.testResults.mount &&
      this.testResults.watch &&
      this.testResults.unmount
    );
  }

  /**
   * 等待指定時間
   */
  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 執行測試
async function main() {
  const tester = new WindowsNetworkTester();
  const success = await tester.runTests();

  if (success) {
    logger.info("所有核心測試通過！Windows 網路監控功能正常");
    process.exit(0);
  } else {
    logger.error("測試失敗，請檢查配置和網路連線");
    process.exit(1);
  }
}

// 處理未捕獲的錯誤
process.on("unhandledRejection", (reason, promise) => {
  logger.logError("未處理的 Promise 拒絕", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.logError("未捕獲的例外", error);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = WindowsNetworkTester;
