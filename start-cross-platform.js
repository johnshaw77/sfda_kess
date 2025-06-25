#!/usr/bin/env node

/**
 * 跨平台啟動腳本
 * 自動偵測作業系統並使用適當的啟動參數
 */

const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

function startKess() {
  const platform = os.platform();
  const isWindows = platform === "win32";

  console.log(`偵測到作業系統: ${platform}`);

  // 根據平台選擇不同的啟動參數
  const nodeArgs = isWindows
    ? ["--openssl-legacy-provider", "src/start.js"]
    : ["src/start.js"];

  console.log(`執行命令: node ${nodeArgs.join(" ")}`);

  // 啟動子程序
  const child = spawn("node", nodeArgs, {
    stdio: "inherit",
    cwd: __dirname,
  });

  // 處理子程序事件
  child.on("error", (error) => {
    console.error("啟動失敗:", error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`程序被 ${signal} 訊號終止`);
    } else {
      console.log(`程序結束，退出代碼: ${code}`);
    }
    process.exit(code);
  });

  // 處理 Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n收到中斷訊號，正在關閉系統...");
    child.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    console.log("\n收到終止訊號，正在關閉系統...");
    child.kill("SIGTERM");
  });
}

startKess();
