#!/usr/bin/env node

/**
 * KESS - Knowledge Extraction and Summary System
 * 知識提取與摘要系統主程式
 */

const KessApplication = require("./index");
const logger = require("./utils/logger");

async function main() {
  const app = new KessApplication();

  try {
    // 初始化系統
    await app.initialize();

    // 啟動系統
    await app.start();

    logger.info("KESS 系統已成功啟動，開始監控檔案變更...");
    logger.info("按 Ctrl+C 可安全關閉系統");
  } catch (error) {
    logger.logError("KESS 系統啟動失敗", error);
    process.exit(1);
  }
}

// 啟動應用程式
main().catch((error) => {
  logger.logError("未預期的錯誤", error);
  process.exit(1);
});
