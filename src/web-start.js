const WebServer = require("./web-server");
const logger = require("./utils/logger");

async function startWebServer() {
  try {
    const webServer = new WebServer();
    const port = process.env.WEB_PORT || 3000;

    logger.info("正在啟動 KESS Web 伺服器...");
    await webServer.start(port);
  } catch (error) {
    logger.error("Web 伺服器啟動失敗:", error);
    console.error("❌ Web 伺服器啟動失敗:", error.message);
    process.exit(1);
  }
}

// 處理程序終止信號
process.on("SIGINT", () => {
  logger.info("收到 SIGINT 信號，正在關閉 Web 伺服器...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("收到 SIGTERM 信號，正在關閉 Web 伺服器...");
  process.exit(0);
});

// 啟動伺服器
startWebServer();
