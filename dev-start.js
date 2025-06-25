#!/usr/bin/env node

/**
 * 開發模式啟動腳本
 * 自動使用 nodemon 和適當的 Node.js 參數
 */

const { spawn } = require("child_process");
const path = require("path");

console.log("啟動 KESS 開發模式...");

// 設定 nodemon 參數
const nodemonArgs = [
  "--exec",
  "node --openssl-legacy-provider",
  "src/start.js",
];

console.log(`執行命令: nodemon ${nodemonArgs.join(" ")}`);

// 啟動 nodemon
const child = spawn("npx", ["nodemon", ...nodemonArgs], {
  stdio: "inherit",
  cwd: __dirname,
  shell: true,
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
  console.log("\n收到中斷訊號，正在關閉開發服務器...");
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  console.log("\n收到終止訊號，正在關閉開發服務器...");
  child.kill("SIGTERM");
});
