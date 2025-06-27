const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const chokidar = require("chokidar");
const EventEmitter = require("events");
const logger = require("../utils/logger");
const WindowsNetworkMonitor = require("./windows-network-monitor");

/**
 * 跨平台網路儲存監控器
 * 根據作業系統自動選擇適當的掛載和監控方式
 */
class CrossPlatformNetworkMonitor extends EventEmitter {
  constructor() {
    super();
    this.platform = process.platform;
    this.mountedPaths = new Map(); // 記錄已掛載的路徑
    this.watchers = new Map(); // 記錄檔案監控器
    this.isActive = false;
    
    // Windows 環境使用原有的 WindowsNetworkMonitor
    if (this.platform === "win32") {
      this.windowsMonitor = new WindowsNetworkMonitor();
      this.setupWindowsMonitorEvents();
    }
  }

  /**
   * 設定 Windows 監控器事件轉發
   */
  setupWindowsMonitorEvents() {
    if (this.windowsMonitor) {
      this.windowsMonitor.on("fileEvent", (eventData) => {
        this.emit("fileEvent", eventData);
      });
      
      this.windowsMonitor.on("error", (error) => {
        this.emit("error", error);
      });
    }
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
      logger.info(`啟動網路儲存監控 (${this.platform})...`);
      this.isActive = true;

      if (this.platform === "win32") {
        // Windows 環境使用原有機制
        await this.windowsMonitor.startMonitoring(networkPaths);
      } else {
        // macOS/Linux 環境使用新機制
        for (const networkPath of networkPaths) {
          await this.mountAndWatchUnix(networkPath);
        }
      }

      logger.info("網路儲存監控啟動完成");
    } catch (error) {
      logger.logError("網路儲存監控啟動失敗", error);
      throw error;
    }
  }

  /**
   * Unix 系統 (macOS/Linux) 掛載和監控
   * @param {string} smbUrl - SMB URL
   */
  async mountAndWatchUnix(smbUrl) {
    try {
      logger.info(`[SMB_MOUNT_UNIX] 開始掛載: ${smbUrl}`);

      // 解析 SMB URL
      const urlInfo = this.parseSmbUrl(smbUrl);
      logger.info(`[SMB_MOUNT_UNIX] 解析結果: ${JSON.stringify({
        host: urlInfo.host,
        share: urlInfo.share,
        path: urlInfo.path,
        username: urlInfo.username
      })}`);

      // 創建掛載點
      const mountPoint = await this.createMountPoint(urlInfo);
      
      // 檢查是否已掛載
      const isAlreadyMounted = await this.checkIfMounted(mountPoint);
      if (!isAlreadyMounted) {
        // 掛載 SMB 共享
        await this.mountSmbShare(mountPoint, urlInfo);
      } else {
        logger.info(`[SMB_MOUNT_UNIX] 路徑已掛載: ${mountPoint}`);
      }

      // 建構完整的監控路徑
      const watchPath = urlInfo.path 
        ? path.join(mountPoint, urlInfo.path)
        : mountPoint;

      // 等待掛載完成
      await this.waitForMount(watchPath);

      // 開始監控
      await this.startWatchingUnix(watchPath, smbUrl);

      // 記錄掛載資訊
      this.mountedPaths.set(smbUrl, {
        mountPoint,
        watchPath,
        urlInfo
      });

      logger.info(`[SMB_MOUNT_UNIX] 掛載和監控成功: ${watchPath}`);
    } catch (error) {
      logger.logError(`[SMB_MOUNT_UNIX] 掛載失敗: ${smbUrl}`, error);
      throw error;
    }
  }

  /**
   * 解析 SMB URL
   * @param {string} smbUrl - SMB URL
   * @returns {Object} 解析後的資訊
   */
  parseSmbUrl(smbUrl) {
    // 支援格式: smb://domain\\username:password@host/share/path
    const match = smbUrl.match(/^smb:\/\/(.+?)\\\\(.+?):(.+?)@(.+?)\/(.+?)(?:\/(.+))?$/);
    if (!match) {
      throw new Error(`無法解析 SMB URL: ${smbUrl}`);
    }

    const [, domain, username, password, host, share, subPath] = match;
    return {
      domain,
      username,
      password,
      host,
      share,
      path: subPath || "",
      uncPath: `//${host}/${share}`
    };
  }

  /**
   * 創建掛載點
   * @param {Object} urlInfo - URL 資訊
   * @returns {string} 掛載點路徑
   */
  async createMountPoint(urlInfo) {
    const baseDir = this.platform === "darwin" ? "/Volumes" : "/mnt";
    const mountName = `kess-${urlInfo.host}-${urlInfo.share}`.replace(/[^a-zA-Z0-9-]/g, "-");
    const mountPoint = path.join(baseDir, mountName);

    try {
      await fs.ensureDir(mountPoint);
      logger.info(`[MOUNT_POINT] 創建掛載點: ${mountPoint}`);
      return mountPoint;
    } catch (error) {
      logger.logError(`[MOUNT_POINT] 創建掛載點失敗: ${mountPoint}`, error);
      throw error;
    }
  }

  /**
   * 檢查路徑是否已掛載
   * @param {string} mountPoint - 掛載點
   * @returns {boolean} 是否已掛載
   */
  async checkIfMounted(mountPoint) {
    try {
      const command = this.platform === "darwin" ? "mount" : "mount";
      const result = await this.execCommand(command);
      return result.includes(mountPoint);
    } catch (error) {
      logger.warn(`[MOUNT_CHECK] 檢查掛載狀態失敗: ${error.message}`);
      return false;
    }
  }

  /**
   * 掛載 SMB 共享
   * @param {string} mountPoint - 掛載點
   * @param {Object} urlInfo - URL 資訊
   */
  async mountSmbShare(mountPoint, urlInfo) {
    try {
      let command;
      
      if (this.platform === "darwin") {
        // macOS 使用 mount_smbfs
        command = `mount -t smbfs //${urlInfo.username}:${urlInfo.password}@${urlInfo.host}/${urlInfo.share} "${mountPoint}"`;
      } else {
        // Linux 使用 mount.cifs
        command = `mount -t cifs //${urlInfo.host}/${urlInfo.share} "${mountPoint}" -o username=${urlInfo.username},password=${urlInfo.password},uid=$(id -u),gid=$(id -g),iocharset=utf8`;
      }

      logger.info(`[SMB_MOUNT] 執行掛載命令 (${this.platform})`);
      
      const result = await this.execCommand(command);
      logger.info(`[SMB_MOUNT] 掛載成功: ${mountPoint}`);
      
    } catch (error) {
      // 檢查是否因為已掛載而失敗
      if (error.message.includes("already mounted") || error.message.includes("Device busy")) {
        logger.info(`[SMB_MOUNT] 路徑已掛載，繼續監控: ${mountPoint}`);
        return;
      }
      throw new Error(`掛載 SMB 共享失敗: ${error.message}`);
    }
  }

  /**
   * 等待掛載完成
   * @param {string} watchPath - 監控路徑
   */
  async waitForMount(watchPath) {
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries) {
      try {
        if (await fs.pathExists(watchPath)) {
          // 嘗試讀取目錄內容以確認掛載正常
          await fs.readdir(watchPath);
          logger.info(`[MOUNT_WAIT] 掛載就緒: ${watchPath}`);
          return;
        }
      } catch (error) {
        // 忽略權限錯誤，主要檢查路徑存在性
      }
      
      logger.info(`[MOUNT_WAIT] 等待掛載就緒: ${watchPath} (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
    }

    throw new Error(`等待掛載超時: ${watchPath}`);
  }

  /**
   * 開始監控 Unix 系統路徑
   * @param {string} watchPath - 監控路徑
   * @param {string} originalUrl - 原始 SMB URL
   */
  async startWatchingUnix(watchPath, originalUrl) {
    try {
      logger.info(`[WATCH_START_UNIX] 開始監控: ${watchPath}`);

      const watcher = chokidar.watch(watchPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: false,
        depth: 10,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        },
        usePolling: true, // 網路文件系統建議使用輪詢
        interval: 1000,
        binaryInterval: 3000
      });

      // 設定事件監聽器
      watcher
        .on("add", (filePath) => {
          this.handleFileEventUnix("add", filePath, originalUrl);
        })
        .on("change", (filePath) => {
          this.handleFileEventUnix("change", filePath, originalUrl);
        })
        .on("unlink", (filePath) => {
          this.handleFileEventUnix("unlink", filePath, originalUrl);
        })
        .on("addDir", (dirPath) => {
          this.handleFileEventUnix("addDir", dirPath, originalUrl);
        })
        .on("unlinkDir", (dirPath) => {
          this.handleFileEventUnix("unlinkDir", dirPath, originalUrl);
        })
        .on("error", (error) => {
          logger.logError(`[WATCH_ERROR_UNIX] 監控錯誤: ${watchPath}`, error);
        })
        .on("ready", () => {
          logger.info(`[WATCH_READY_UNIX] 監控器就緒: ${watchPath}`);
        });

      this.watchers.set(originalUrl, watcher);
    } catch (error) {
      logger.logError(`[WATCH_START_UNIX] 開始監控失敗: ${watchPath}`, error);
      throw error;
    }
  }

  /**
   * 處理 Unix 系統檔案事件
   * @param {string} eventType - 事件類型
   * @param {string} filePath - 檔案路徑
   * @param {string} originalUrl - 原始 SMB URL
   */
  handleFileEventUnix(eventType, filePath, originalUrl) {
    try {
      let eventData = {
        type: eventType,
        path: filePath,
        originalUrl,
        timestamp: new Date().toISOString(),
        fileName: path.basename(filePath),
        fileExtension: path.extname(filePath).toLowerCase()
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
            isFile: stats.isFile()
          };
        }
      } catch (statError) {
        logger.warn(`[FILE_EVENT_UNIX] 無法取得檔案資訊: ${filePath} - ${statError.message}`);
      }

      this.emit("fileEvent", eventData);

      logger.info(`[FILE_EVENT_UNIX] ${eventType}: ${filePath}${eventData.isDirectory ? " (目錄)" : ""}`);
    } catch (error) {
      logger.logError(`[FILE_EVENT_UNIX] 處理檔案事件失敗: ${filePath}`, error);
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

      if (this.platform === "win32" && this.windowsMonitor) {
        // Windows 環境
        await this.windowsMonitor.stopMonitoring();
      } else {
        // Unix 環境
        // 關閉所有監控器
        for (const [url, watcher] of this.watchers) {
          await watcher.close();
          logger.info(`[WATCH_STOP_UNIX] 已停止監控: ${url}`);
        }

        // 可選：卸載網路共享（通常系統重啟後會自動卸載）
        // 為避免影響其他程序，這裡不自動卸載
        
        this.watchers.clear();
        this.mountedPaths.clear();
      }

      this.isActive = false;
      logger.info("網路儲存監控已停止");
    } catch (error) {
      logger.logError("停止網路儲存監控失敗", error);
    }
  }

  /**
   * 執行命令的輔助方法
   * @param {string} command - 要執行的命令
   * @returns {Promise<string>} 命令輸出
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`命令執行失敗: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * 取得監控狀態
   * @returns {Object} 監控狀態
   */
  getStatus() {
    return {
      platform: this.platform,
      isActive: this.isActive,
      mountedPaths: Array.from(this.mountedPaths.keys()),
      watcherCount: this.watchers.size
    };
  }
}

module.exports = CrossPlatformNetworkMonitor;