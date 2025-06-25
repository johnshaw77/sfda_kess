#!/usr/bin/env node

/**
 * 簡單的 SMB 連線測試
 */

const SMB2 = require("@marsaud/smb2");

async function testSMBConnection() {
  console.log("開始測試 SMB 連線...");

  // SMB 連線參數
  const smbUrl = "smb://flexium\\john_hsiao:qsceszK29@10.1.1.127/P-Temp/TOJohn";
  console.log(`測試連線: ${smbUrl}`);

  try {
    // 手動解析 SMB URL（因為標準 URL 解析器處理不了反斜線）
    const match = smbUrl.match(
      /^smb:\/\/(.+?)\\(.+?):(.+?)@(.+?)\/(.+?)\/(.+)$/
    );
    if (!match) {
      throw new Error("無法解析 SMB URL 格式");
    }

    const [, domain, username, password, host, share, path] = match;

    console.log("連線參數:");
    console.log(`- 主機: ${host}`);
    console.log(`- 網域: ${domain}`);
    console.log(`- 使用者: ${username}`);
    console.log(`- 密碼: ${"*".repeat(password.length)}`);
    console.log(`- 共享: ${share}`);
    console.log(`- 路徑: ${path}`);

    // 建立 SMB2 客戶端
    const smb2Client = new SMB2({
      share: `\\\\${host}\\${share}`,
      domain: domain,
      username: username,
      password: password,
      autoCloseTimeout: 0,
    });

    console.log("\n正在建立 SMB2 連線...");

    // 測試連線 - 列出根目錄
    const files = await new Promise((resolve, reject) => {
      smb2Client.readdir(path || "", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
    console.log("✅ SMB 連線成功！");
    console.log(`找到 ${files.length} 個項目:`);

    files.slice(0, 10).forEach((file, index) => {
      const type = file.Directory ? "[資料夾]" : "[檔案]";
      const filename = file.Filename || file.FileName || "[名稱未知]";
      const size = file.Directory
        ? ""
        : ` (${file.EndOfFile || file.FileSize || "未知大小"} bytes)`;
      console.log(`  ${index + 1}. ${type} ${filename}${size}`);
    });

    if (files.length > 10) {
      console.log(`  ... 還有 ${files.length - 10} 個項目`);
    }

    // 關閉連線
    smb2Client.disconnect();
    console.log("\n連線已關閉");
  } catch (error) {
    console.error("❌ SMB 連線失敗:");
    console.error("錯誤類型:", error.name);
    console.error("錯誤訊息:", error.message);
    console.error("錯誤代碼:", error.code);

    if (error.stack) {
      console.error("\n完整錯誤堆疊:");
      console.error(error.stack);
    }

    // 常見錯誤的解決建議
    if (error.code === "ECONNREFUSED") {
      console.error("\n可能的解決方案:");
      console.error("1. 檢查主機 IP 是否正確");
      console.error("2. 檢查防火牆設定");
      console.error("3. 確認 SMB 服務是否啟用");
    } else if (
      error.message.includes("Access") ||
      error.message.includes("authentication")
    ) {
      console.error("\n可能的解決方案:");
      console.error("1. 檢查使用者名稱和密碼");
      console.error("2. 檢查網域名稱");
      console.error("3. 確認使用者有存取權限");
    } else if (
      error.message.includes("share") ||
      error.message.includes("path")
    ) {
      console.error("\n可能的解決方案:");
      console.error("1. 檢查共享名稱是否正確");
      console.error("2. 檢查路徑是否存在");
      console.error("3. 確認共享是否啟用");
    }
  }
}

// 執行測試
testSMBConnection().catch(console.error);
