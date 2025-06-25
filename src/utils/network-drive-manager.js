const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

const execAsync = promisify(exec);

class NetworkDriveManager {
  constructor() {
    this.mountedDrives = new Set();
  }

  /**
   * 自動掛載網路磁碟機
   * @param {string} serverPath - 伺服器路徑 (例如: //192.168.1.100/shared)
   * @param {string} mountPoint - 掛載點 (例如: /Volumes/CompanyDrive)
   * @param {Object} credentials - 認證資訊
   * @returns {Promise<boolean>} 掛載是否成功
   */
  async mountNetworkDrive(serverPath, mountPoint, credentials = {}) {
    try {
      logger.logProcessing(
        "MOUNT_START",
        `開始掛載網路磁碟機: ${serverPath} -> ${mountPoint}`
      );

      // 檢查掛載點是否已存在
      if (await fs.pathExists(mountPoint)) {
        // 檢查是否已經掛載
        if (await this.isDriveMounted(mountPoint)) {
          logger.info(`磁碟機已掛載: ${mountPoint}`);
          this.mountedDrives.add(mountPoint);
          return true;
        }
      } else {
        // 創建掛載點目錄
        await fs.ensureDir(mountPoint);
      }

      // 建立掛載命令
      let mountCommand;
      const { username, password, domain } = credentials;

      if (serverPath.startsWith("smb://") || serverPath.includes("//")) {
        // SMB/CIFS 掛載
        const smbPath = serverPath.replace(/^smb:\/\//, "//");
        mountCommand = `mount -t smbfs`;

        if (username && password) {
          const authString = domain
            ? `${domain}\\${username}:${password}`
            : `${username}:${password}`;
          mountCommand += ` -o username=${username},password=${password}`;
        }

        mountCommand += ` "${smbPath}" "${mountPoint}"`;
      } else {
        throw new Error(`不支援的網路協議: ${serverPath}`);
      }

      // 執行掛載命令
      await execAsync(mountCommand);

      // 驗證掛載是否成功
      const mounted = await this.isDriveMounted(mountPoint);
      if (mounted) {
        this.mountedDrives.add(mountPoint);
        logger.logProcessing(
          "MOUNT_SUCCESS",
          `網路磁碟機掛載成功: ${mountPoint}`
        );
        return true;
      } else {
        throw new Error("掛載後驗證失敗");
      }
    } catch (error) {
      logger.logError(`網路磁碟機掛載失敗: ${serverPath}`, error);
      return false;
    }
  }

  /**
   * 卸載網路磁碟機
   * @param {string} mountPoint - 掛載點
   * @returns {Promise<boolean>} 卸載是否成功
   */
  async unmountNetworkDrive(mountPoint) {
    try {
      logger.logProcessing(
        "UNMOUNT_START",
        `開始卸載網路磁碟機: ${mountPoint}`
      );

      if (!(await this.isDriveMounted(mountPoint))) {
        logger.info(`磁碟機未掛載: ${mountPoint}`);
        return true;
      }

      // 執行卸載命令
      await execAsync(`umount "${mountPoint}"`);

      // 驗證卸載是否成功
      const mounted = await this.isDriveMounted(mountPoint);
      if (!mounted) {
        this.mountedDrives.delete(mountPoint);
        logger.logProcessing(
          "UNMOUNT_SUCCESS",
          `網路磁碟機卸載成功: ${mountPoint}`
        );
        return true;
      } else {
        throw new Error("卸載後驗證失敗");
      }
    } catch (error) {
      logger.logError(`網路磁碟機卸載失敗: ${mountPoint}`, error);
      return false;
    }
  }

  /**
   * 檢查磁碟機是否已掛載
   * @param {string} mountPoint - 掛載點
   * @returns {Promise<boolean>} 是否已掛載
   */
  async isDriveMounted(mountPoint) {
    try {
      const { stdout } = await execAsync("mount");
      return stdout.includes(mountPoint);
    } catch (error) {
      logger.logError("檢查掛載狀態失敗", error);
      return false;
    }
  }

  /**
   * 列出所有已掛載的網路磁碟機
   * @returns {Promise<Array>} 已掛載的磁碟機清單
   */
  async listMountedDrives() {
    try {
      const { stdout } = await execAsync("mount | grep -E '(smbfs|afpfs|nfs)'");
      const drives = stdout
        .trim()
        .split("\n")
        .map((line) => {
          const parts = line.split(" on ");
          if (parts.length >= 2) {
            const server = parts[0];
            const mountInfo = parts[1].split(" (");
            const mountPoint = mountInfo[0];
            const type = mountInfo[1] ? mountInfo[1].split(",")[0] : "unknown";
            return { server, mountPoint, type };
          }
          return null;
        })
        .filter(Boolean);

      return drives;
    } catch (error) {
      // 如果沒有找到網路磁碟機，grep 會返回錯誤，這是正常的
      return [];
    }
  }

  /**
   * 自動掛載配置的監控資料夾
   * @param {Array<string>} watchFolders - 監控資料夾清單
   * @param {Object} credentials - 認證資訊
   * @returns {Promise<Array>} 成功掛載的資料夾清單
   */
  async autoMountWatchFolders(watchFolders, credentials = {}) {
    const mountedFolders = [];

    for (const folder of watchFolders) {
      try {
        // 檢查是否為網路路徑
        if (this.isNetworkPath(folder)) {
          // 如果是 /Volumes/ 路徑，檢查是否需要掛載
          if (folder.startsWith("/Volumes/")) {
            const mounted = await this.isDriveMounted(folder);
            if (!mounted) {
              logger.warn(`網路磁碟機未掛載，請手動掛載: ${folder}`);
              logger.info(
                "您可以使用 Finder -> 前往 -> 連接伺服器 來掛載網路磁碟機"
              );
            } else {
              mountedFolders.push(folder);
            }
          }
          // 如果是 smb:// 等直接路徑，嘗試自動掛載
          else if (folder.startsWith("smb://")) {
            const mountPoint = `/Volumes/${path.basename(folder)}`;
            const success = await this.mountNetworkDrive(
              folder,
              mountPoint,
              credentials
            );
            if (success) {
              mountedFolders.push(mountPoint);
            }
          }
        } else {
          // 本機路徑直接加入
          mountedFolders.push(folder);
        }
      } catch (error) {
        logger.logError(`處理監控資料夾失敗: ${folder}`, error);
      }
    }

    return mountedFolders;
  }

  /**
   * 檢查路徑是否為網路路徑
   * @param {string} folderPath - 資料夾路徑
   * @returns {boolean} 是否為網路路徑
   */
  isNetworkPath(folderPath) {
    const networkPatterns = [
      /^\/Volumes\//,
      /^smb:\/\//,
      /^afp:\/\//,
      /^nfs:\/\//,
    ];

    return networkPatterns.some((pattern) => pattern.test(folderPath));
  }

  /**
   * 檢查網路連線狀態
   * @param {string} serverPath - 伺服器路徑
   * @returns {Promise<boolean>} 連線是否正常
   */
  async checkNetworkConnection(serverPath) {
    try {
      // 從路徑中提取 IP 或主機名
      const urlParts = serverPath.match(/\/\/([^\/]+)/);
      if (!urlParts) return false;

      const host = urlParts[1];

      // 使用 ping 檢查連線
      await execAsync(`ping -c 1 -W 3000 ${host}`);
      return true;
    } catch (error) {
      logger.warn(`網路連線檢查失敗: ${serverPath}`);
      return false;
    }
  }

  /**
   * 清理所有掛載的網路磁碟機
   */
  async cleanupMountedDrives() {
    logger.info("開始清理網路磁碟機掛載...");

    for (const mountPoint of this.mountedDrives) {
      await this.unmountNetworkDrive(mountPoint);
    }

    this.mountedDrives.clear();
    logger.info("網路磁碟機掛載清理完成");
  }

  /**
   * 取得掛載狀態報告
   * @returns {Object} 掛載狀態報告
   */
  getMountStatus() {
    return {
      mountedCount: this.mountedDrives.size,
      mountedDrives: Array.from(this.mountedDrives),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = NetworkDriveManager;
