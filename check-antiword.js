#!/usr/bin/env node

/**
 * 檢查和安裝 antiword 工具的腳本
 */

const { exec } = require("child_process");
const os = require("os");

async function checkAntiword() {
  return new Promise((resolve) => {
    exec("antiword -h", (error, stdout, stderr) => {
      if (error) {
        resolve({
          installed: false,
          error: error.message,
          stdout: stdout,
          stderr: stderr,
        });
      } else {
        resolve({
          installed: true,
          stdout: stdout,
          stderr: stderr,
        });
      }
    });
  });
}

async function installAntiwordWindows() {
  console.log("在 Windows 上安裝 antiword...");
  console.log("");
  console.log("Windows 安裝選項：");
  console.log("1. 使用 Chocolatey: choco install antiword");
  console.log("2. 使用 Scoop: scoop install antiword");
  console.log("3. 手動下載並安裝: http://www.winfield.demon.nl/");
  console.log("");
  console.log("推薦使用 Chocolatey 安裝:");
  console.log("  1. 以管理員身份打開 PowerShell");
  console.log(
    '  2. 運行: Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))'
  );
  console.log("  3. 重啟 PowerShell");
  console.log("  4. 運行: choco install antiword");

  return false; // 需要手動安裝
}

async function installAntiwordLinux() {
  console.log("嘗試在 Linux 上安裝 antiword...");

  return new Promise((resolve) => {
    // 嘗試使用 apt-get
    exec(
      "sudo apt-get update && sudo apt-get install -y antiword",
      (error, stdout, stderr) => {
        if (error) {
          console.log("apt-get 安裝失敗，嘗試 yum...");
          exec("sudo yum install -y antiword", (error2, stdout2, stderr2) => {
            if (error2) {
              console.log("自動安裝失敗，請手動安裝 antiword");
              console.log("Ubuntu/Debian: sudo apt-get install antiword");
              console.log("RHEL/CentOS: sudo yum install antiword");
              resolve(false);
            } else {
              console.log("antiword 安裝成功 (yum)");
              resolve(true);
            }
          });
        } else {
          console.log("antiword 安裝成功 (apt-get)");
          resolve(true);
        }
      }
    );
  });
}

async function installAntiwordMac() {
  console.log("嘗試在 macOS 上安裝 antiword...");

  return new Promise((resolve) => {
    exec("brew install antiword", (error, stdout, stderr) => {
      if (error) {
        console.log("Homebrew 安裝失敗");
        console.log(
          '請先安裝 Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        );
        console.log("然後運行: brew install antiword");
        resolve(false);
      } else {
        console.log("antiword 安裝成功 (Homebrew)");
        resolve(true);
      }
    });
  });
}

async function main() {
  console.log("正在檢查 antiword 工具...");

  const result = await checkAntiword();

  if (result.installed) {
    console.log("✅ antiword 已安裝並可用");
    console.log("輸出:", result.stdout.split("\n")[0]);
    return true;
  } else {
    console.log("❌ antiword 未安裝或不可用");
    console.log("錯誤:", result.error);
    console.log("");

    const platform = os.platform();
    let installed = false;

    switch (platform) {
      case "win32":
        installed = await installAntiwordWindows();
        break;
      case "linux":
        installed = await installAntiwordLinux();
        break;
      case "darwin":
        installed = await installAntiwordMac();
        break;
      default:
        console.log("不支援的作業系統:", platform);
        break;
    }

    if (installed) {
      // 重新檢查
      const recheck = await checkAntiword();
      if (recheck.installed) {
        console.log("✅ antiword 現在已可用");
        return true;
      }
    }

    console.log("");
    console.log("⚠️  antiword 未安裝，.doc 檔案處理將會降級");
    console.log(
      "系統將為 .doc 檔案提供友善的錯誤訊息，建議將檔案轉換為 .docx 格式"
    );
    return false;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkAntiword, main };
