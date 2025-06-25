const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const chokidar = require("chokidar");
const EventEmitter = require("events");
const logger = require("../utils/logger");

/**
 * Windows 原生網路磁碟監控器
 * 使用 net use 命令掛載 SMB 共享，然後用 chokidar 監控
 */
class WindowsNetworkMonitor extends EventEmitter {
  constructor() {
    super();
    this.mountedDrives = new Map(); // 記錄已掛載的磁碟機
    this.watchers = new Map(); // 記錄檔案監控器
    this.isActive = false;
  }

  /**
   * 開始監控網路儲存
   * @param {Array<string>} networkPaths - 網路路徑陣列
   */
  async startMonitoring(networkPaths = []) {
    if (this.isActive) {
      logger.warn("網路儲存監控已在運行中");
      return;
    }

    try {
      logger.info("啟動網路儲存監控...");
      this.isActive = true;

      for (const networkPath of networkPaths) {
        await this.mountAndWatch(networkPath);
      }

      logger.info("網路儲存監控啟動完成");
    } catch (error) {
      logger.logError("網路儲存監控啟動失敗", error);
      throw error;
    }
  }
  /**
   * 掛載網路磁碟並開始監控
   * @param {string} smbUrl - SMB URL
   */
  async mountAndWatch(smbUrl) {
    try {
      logger.info(`[SMB_MOUNT] 開始掛載: ${smbUrl}`);

      // 檢查是否已經掛載
      if (this.mountedDrives.has(smbUrl)) {
        logger.warn(`[SMB_MOUNT] 路徑已掛載，跳過: ${smbUrl}`);
        return;
      }

      // 解析 SMB URL
      const urlInfo = this.parseSmbUrl(smbUrl);
      logger.info(`[SMB_MOUNT] 解析結果: ${JSON.stringify(urlInfo)}`);

      // 找到可用的磁碟機代號
      const driveLetter = await this.findAvailableDrive();
      logger.info(`[SMB_MOUNT] 使用磁碟機: ${driveLetter}`);

      // 掛載網路磁碟
      await this.mountNetworkDrive(driveLetter, urlInfo);

      // 建構完整的監控路徑
      const mountPath = urlInfo.path
        ? `${driveLetter}:\\${urlInfo.path}`
        : `${driveLetter}:\\`;

      // 等待一小段時間確保掛載完全完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 開始監控掛載的磁碟
      await this.startWatching(mountPath, smbUrl);

      // 記錄掛載資訊
      this.mountedDrives.set(smbUrl, {
        driveLetter,
        mountPath,
        urlInfo,
      });

      logger.info(`[SMB_MOUNT] 掛載成功: ${mountPath}`);
    } catch (error) {
      logger.logError(`[SMB_MOUNT] 掛載失敗: ${smbUrl}`, error);
      throw error;
    }
  }

  /**
   * 解析 SMB URL
   * @param {string} smbUrl - SMB URL
   * @returns {Object} 解析後的資訊
   */
  parseSmbUrl(smbUrl) {
    // smb://flexium\\john_hsiao:qsceszK29@10.1.1.127/P-Temp/TOJohn
    const match = smbUrl.match(
      /^smb:\/\/(.+?)\\\\(.+?):(.+?)@(.+?)\/(.+?)\/(.+)$/
    );
    if (!match) {
      throw new Error(`無法解析 SMB URL: ${smbUrl}`);
    }

    const [, domain, username, password, host, share, path] = match;
    return {
      domain,
      username,
      password,
      host,
      share,
      path: path || "",
      uncPath: `\\\\${host}\\${share}`,
    };
  }

  /**
   * 找到可用的磁碟機代號
   * @returns {string} 可用的磁碟機代號
   */
  async findAvailableDrive() {
    const usedDrives = await this.getUsedDrives();
    const availableLetters = "ZYXWVUTSRQPONMLKJIHGFED";

    for (const letter of availableLetters) {
      if (!usedDrives.includes(letter)) {
        return letter;
      }
    }

    throw new Error("沒有可用的磁碟機代號");
  }

  /**
   * 取得已使用的磁碟機代號
   * @returns {Array<string>} 已使用的磁碟機代號陣列
   */
  getUsedDrives() {
    return new Promise((resolve, reject) => {
      exec("wmic logicaldisk get size,caption", (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        const drives = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.match(/^[A-Z]:/))
          .map((line) => line.charAt(0));

        resolve(drives);
      });
    });
  }

  /**
   * 掛載網路磁碟
   * @param {string} driveLetter - 磁碟機代號
   * @param {Object} urlInfo - URL 資訊
   */
  mountNetworkDrive(driveLetter, urlInfo) {
    return new Promise((resolve, reject) => {
      const netUseCmd = `net use ${driveLetter}: "${urlInfo.uncPath}" /user:"${urlInfo.domain}\\${urlInfo.username}" "${urlInfo.password}" /persistent:no`;

      logger.info(
        `[SMB_MOUNT] 執行命令: net use ${driveLetter}: "${urlInfo.uncPath}" /user:"${urlInfo.domain}\\${urlInfo.username}" "***" /persistent:no`
      );

      exec(netUseCmd, (error, stdout, stderr) => {
        if (error) {
          logger.logError(`[SMB_MOUNT] 掛載失敗`, error);
          reject(new Error(`掛載失敗: ${stderr || error.message}`));
          return;
        }

        logger.info(`[SMB_MOUNT] 掛載輸出: ${stdout}`);
        resolve();
      });
    });
  }
  /**
   * 開始監控掛載的路徑
   * @param {string} mountPath - 掛載路徑
   * @param {string} originalUrl - 原始 SMB URL
   */
  async startWatching(mountPath, originalUrl) {
    try {
      // 檢查路徑是否存在
      let retryCount = 0;
      const maxRetries = 5;

      while (retryCount < maxRetries) {
        if (await fs.pathExists(mountPath)) {
          break;
        }
        logger.info(
          `[WATCH_START] 等待路徑就緒: ${mountPath} (嘗試 ${
            retryCount + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retryCount++;
      }

      if (retryCount >= maxRetries) {
        throw new Error(`掛載路徑不存在或無法存取: ${mountPath}`);
      }

      logger.info(`[WATCH_START] 開始監控: ${mountPath}`);

      // 建立檔案監控器
      const watcher = chokidar.watch(mountPath, {
        ignored: /(^|[\/\\])\../, // 忽略隱藏檔案
        persistent: true,
        ignoreInitial: false,
        depth: 10,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100,
        },
        usePolling: true, // 在網路磁碟上使用輪詢會比較穩定
        interval: 1000,
        binaryInterval: 3000,
      });

      // 設定事件監聽器
      watcher
        .on("add", (filePath) => {
          this.handleFileEvent("add", filePath, originalUrl);
        })
        .on("change", (filePath) => {
          this.handleFileEvent("change", filePath, originalUrl);
        })
        .on("unlink", (filePath) => {
          this.handleFileEvent("unlink", filePath, originalUrl);
        })
        .on("addDir", (dirPath) => {
          this.handleFileEvent("addDir", dirPath, originalUrl);
        })
        .on("unlinkDir", (dirPath) => {
          this.handleFileEvent("unlinkDir", dirPath, originalUrl);
        })
        .on("error", (error) => {
          logger.logError(`[WATCH_ERROR] 監控錯誤: ${mountPath}`, error);
        })
        .on("ready", () => {
          logger.info(`[WATCH_READY] 監控器就緒: ${mountPath}`);
        });

      // 記錄監控器
      this.watchers.set(originalUrl, watcher);
    } catch (error) {
      logger.logError(`[WATCH_START] 開始監控失敗: ${mountPath}`, error);
      throw error;
    }
  }
  /**
   * 處理檔案事件
   * @param {string} eventType - 事件類型
   * @param {string} filePath - 檔案路徑
   * @param {string} originalUrl - 原始 SMB URL
   */
  handleFileEvent(eventType, filePath, originalUrl) {
    try {
      let eventData = {
        type: eventType,
        path: filePath,
        originalUrl,
        timestamp: new Date().toISOString(),
        fileName: path.basename(filePath),
        fileExtension: path.extname(filePath).toLowerCase(),
      };

      // 嘗試取得檔案資訊
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          eventData = {
            ...eventData,
            size: stats.size,
            modified: stats.mtime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
          };
        }
      } catch (statError) {
        logger.warn(
          `[FILE_EVENT] 無法取得檔案資訊: ${filePath} - ${statError.message}`
        );
      }

      this.emit("fileEvent", eventData);

      logger.info(
        `[FILE_EVENT] ${eventType}: ${filePath}${
          eventData.isDirectory ? " (目錄)" : ""
        }`
      );
    } catch (error) {
      logger.logError(`[FILE_EVENT] 處理檔案事件失敗: ${filePath}`, error);
    }
  }

  /**
   * 停止監控
   */
  async stopMonitoring() {
    if (!this.isActive) {
      return;
    }

    try {
      logger.info("停止網路儲存監控...");

      // 關閉所有監控器
      for (const [url, watcher] of this.watchers) {
        await watcher.close();
        logger.info(`[WATCH_STOP] 已停止監控: ${url}`);
      }

      // 卸載所有網路磁碟
      for (const [url, mountInfo] of this.mountedDrives) {
        await this.unmountNetworkDrive(mountInfo.driveLetter);
        logger.info(`[SMB_UNMOUNT] 已卸載: ${mountInfo.driveLetter}`);
      }

      // 清理
      this.watchers.clear();
      this.mountedDrives.clear();
      this.isActive = false;

      logger.info("網路儲存監控已停止");
    } catch (error) {
      logger.logError("停止網路儲存監控失敗", error);
    }
  }

  /**
   * 卸載網路磁碟
   * @param {string} driveLetter - 磁碟機代號
   */
  unmountNetworkDrive(driveLetter) {
    return new Promise((resolve, reject) => {
      const netUseCmd = `net use ${driveLetter}: /delete /y`;

      exec(netUseCmd, (error, stdout, stderr) => {
        if (error) {
          logger.warn(`[SMB_UNMOUNT] 卸載警告: ${stderr || error.message}`);
        } else {
          logger.info(`[SMB_UNMOUNT] 卸載輸出: ${stdout}`);
        }
        resolve();
      });
    });
  }
}

module.exports = WindowsNetworkMonitor;
