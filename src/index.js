const config = require("../config");
const logger = require("./utils/logger");
const dbConnection = require("./database/connection");
const FileWatcher = require("./monitor/file-watcher");
const DocumentProcessor = require("./processor/document-processor");
const SummaryService = require("./services/summary-service");
const DatabaseMigration = require("./database/migrations/migrate");
const CrossPlatformNetworkMonitor = require("./monitor/cross-platform-network-monitor");
const path = require("path");

class KessApplication {
  constructor() {
    this.fileWatcher = null;
    this.documentProcessor = null;
    this.summaryService = null;
    this.networkMonitor = null;
    this.isRunning = false;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * 初始化應用程式
   */
  async initialize() {
    try {
      logger.info("KESS 系統初始化開始...");

      // 1. 初始化資料庫連線
      await this.initializeDatabase();

      // 2. 初始化各個服務
      await this.initializeServices();

      // 3. 設定事件監聽器
      this.setupEventListeners();

      logger.info("KESS 系統初始化完成");
    } catch (error) {
      logger.logError("KESS 系統初始化失敗", error);
      throw error;
    }
  }

  /**
   * 初始化資料庫
   */
  async initializeDatabase() {
    try {
      logger.logProcessing("DB_INIT", "初始化資料庫連線...");

      // 初始化連線
      await dbConnection.initialize();

      // 執行資料庫遷移
      const migration = new DatabaseMigration();
      const tableStatus = await migration.checkTables();

      // 檢查是否需要遷移
      const missingTables = Object.entries(tableStatus)
        .filter(([table, exists]) => !exists)
        .map(([table]) => table);

      if (missingTables.length > 0) {
        logger.logProcessing(
          "DB_MIGRATE",
          `需要建立表格: ${missingTables.join(", ")}`
        );
        await migration.migrate();
      }

      // 初始化監控資料夾設定
      await migration.initializeWatchedFolders(config.monitoring.watchFolders);

      logger.logProcessing("DB_INIT", "資料庫初始化完成");
    } catch (error) {
      logger.logError("資料庫初始化失敗", error);
      throw error;
    }
  }

  /**
   * 初始化各個服務
   */
  async initializeServices() {
    try {
      logger.logProcessing("SERVICE_INIT", "初始化服務模組...");

      // 初始化文件處理器
      this.documentProcessor = new DocumentProcessor();

      // 初始化摘要服務
      this.summaryService = new SummaryService();
      await this.summaryService.initialize();

      // 初始化檔案監控器
      this.fileWatcher = new FileWatcher();

      // 初始化跨平台網路監控器
      if (config.monitoring.enableNetworkMonitoring) {
        this.networkMonitor = new CrossPlatformNetworkMonitor();
        logger.info(`跨平台網路監控器已初始化 (${process.platform})`);
      }

      logger.logProcessing("SERVICE_INIT", "服務模組初始化完成");
    } catch (error) {
      logger.logError("服務初始化失敗", error);
      throw error;
    }
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    try {
      logger.logProcessing("EVENT_SETUP", "設定事件監聽器...");

      // 檔案變更事件
      this.fileWatcher.on("fileEvent", async (eventData) => {
        await this.handleFileEvent(eventData);
      });

      // 錯誤事件
      this.fileWatcher.on("error", (error) => {
        logger.logError("檔案監控器發生錯誤", error);
      });

      // 系統訊號處理
      process.on("SIGINT", () => {
        logger.info("收到 SIGINT 訊號，正在關閉系統...");
        this.shutdown();
      });

      process.on("SIGTERM", () => {
        logger.info("收到 SIGTERM 訊號，正在關閉系統...");
        this.shutdown();
      });

      logger.logProcessing("EVENT_SETUP", "事件監聽器設定完成");
    } catch (error) {
      logger.logError("事件監聽器設定失敗", error);
      throw error;
    }
  }

  /**
   * 啟動應用程式
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn("KESS 系統已在執行中");
        return;
      }

      logger.info("啟動 KESS 系統...");

      // 檢查並掛載網路磁碟機
      if (config.monitoring.enableNetworkMonitoring) {
        await this.setupNetworkDrives();
      }

      // 開始檔案監控
      if (config.processing.enableRealTimeMonitoring) {
        // 從資料庫載入監控資料夾
        const watchFolders = await this.categoryService.getWatchFolders();
        await this.fileWatcher.startWatching(watchFolders);
      }

      // 初始掃描現有檔案
      await this.performInitialScan();

      // 設定系統運行狀態（必須在啟動處理佇列之前）
      this.isRunning = true;

      // 啟動處理佇列
      this.startProcessingQueue();

      logger.info("KESS 系統啟動完成");

      // 顯示系統狀態
      await this.logSystemStatus();
    } catch (error) {
      logger.logError("KESS 系統啟動失敗", error);
      throw error;
    }
  }

  /**
   * 執行初始檔案掃描
   */
  async performInitialScan() {
    try {
      logger.logProcessing("INITIAL_SCAN", "開始初始檔案掃描...");

      // 從資料庫載入監控資料夾
      const watchFolders = await this.categoryService.getWatchFolders();

      for (const folder of watchFolders) {
        await this.fileWatcher.scanExistingFiles(folder);
      }

      logger.logProcessing("INITIAL_SCAN", "初始檔案掃描完成");
    } catch (error) {
      logger.logError("初始檔案掃描失敗", error);
    }
  }

  /**
   * 處理檔案事件
   * @param {Object} eventData - 檔案事件資料
   */
  async handleFileEvent(eventData) {
    try {
      // 處理來自 Windows 網路監控器的事件格式
      if (eventData.originalUrl) {
        // 來自網路監控器的事件，需要轉換格式
        const fileName = path.basename(eventData.path);

        // 跳過目錄事件
        if (eventData.isDirectory) {
          logger.info(
            `[FILE_EVENT] 跳過目錄事件: ${eventData.type} - ${eventData.path}`
          );
          return;
        }

        // 轉換為統一格式
        eventData = {
          eventType: eventData.type,
          filePath: eventData.path,
          fileInfo: {
            fileName: fileName,
            fileExtension:
              eventData.fileExtension ||
              path.extname(eventData.path).toLowerCase(),
            fileSize: eventData.size || 0, // 修正屬性名稱
            fileModifiedTime: eventData.modified || new Date(), // 修正屬性名稱
            isDirectory: eventData.isDirectory || false,
            isFile: eventData.isFile || !eventData.isDirectory,
          },
          originalUrl: eventData.originalUrl,
        };
      }

      const { eventType, filePath, fileInfo } = eventData;

      logger.logProcessing("FILE_EVENT", `處理檔案事件: ${eventType}`, {
        filePath: filePath,
        fileName: fileInfo.fileName,
        currentQueueLength: this.processingQueue.length,
      });

      // 將檔案加入處理佇列
      this.processingQueue.push({
        ...eventData,
        addedAt: new Date(),
        attempts: 0,
      });

      logger.logProcessing(
        "QUEUE_ADD",
        `檔案加入處理佇列: ${fileInfo.fileName}`,
        {
          queueLength: this.processingQueue.length,
          isProcessing: this.isProcessing,
          isRunning: this.isRunning,
        }
      );

      // 檢查處理佇列是否需要重新啟動
      if (!this.isProcessing && this.isRunning) {
        logger.logProcessing("QUEUE_RESTART", "處理佇列已停止，重新啟動");
        this.isProcessing = false;
        this.startProcessingQueue();
      }
    } catch (error) {
      logger.logError(
        `處理檔案事件失敗: ${eventData.filePath || eventData.path}`,
        error
      );
    }
  }

  /**
   * 啟動處理佇列
   */
  startProcessingQueue() {
    if (this.isProcessing) {
      logger.warn("處理佇列已在執行中");
      return;
    }

    this.isProcessing = true;
    logger.logProcessing("QUEUE_START", "啟動處理佇列");

    const processQueue = async () => {
      try {
        logger.logProcessing("QUEUE_CHECK", `檢查處理佇列`, {
          queueLength: this.processingQueue.length,
          isRunning: this.isRunning,
        });

        while (this.isRunning && this.processingQueue.length > 0) {
          const batchSize = Math.min(
            config.processing.batchSize,
            this.processingQueue.length
          );
          const batch = this.processingQueue.splice(0, batchSize);

          logger.logProcessing("QUEUE_PROCESSING", `處理批次`, {
            batchSize: batch.length,
            remainingQueue: this.processingQueue.length,
          });

          try {
            await this.processBatch(batch);
          } catch (error) {
            logger.logError("批次處理失敗", error);
          }

          // 處理延遲
          if (config.processing.processingDelay > 0) {
            await this.delay(config.processing.processingDelay);
          }
        }

        // 如果佇列為空，等待一段時間後再檢查
        if (this.isRunning) {
          logger.logProcessing("QUEUE_WAIT", `佇列為空，等待 5 秒後再檢查`);
          setTimeout(processQueue, 5000);
        } else {
          logger.logProcessing("QUEUE_STOP", "系統已停止，結束處理佇列");
        }
      } catch (error) {
        logger.logError("處理佇列發生錯誤", error);
        // 發生錯誤時，等待一段時間後重試
        if (this.isRunning) {
          setTimeout(processQueue, 10000);
        }
      }
    };

    // 立即開始處理佇列
    processQueue().catch((error) => {
      logger.logError("啟動處理佇列失敗", error);
    });
  }

  /**
   * 處理檔案批次
   * @param {Array} batch - 檔案批次
   */
  async processBatch(batch) {
    try {
      logger.logProcessing(
        "BATCH_PROCESS",
        `開始處理批次: ${batch.length} 個檔案`
      );

      for (const item of batch) {
        try {
          await this.processFile(item);
        } catch (error) {
          logger.logError(`處理檔案失敗: ${item.filePath}`, error);

          // 重試機制
          item.attempts++;
          if (item.attempts < config.processing.retryAttempts) {
            this.processingQueue.push(item);
            logger.logProcessing(
              "RETRY",
              `檔案重新加入佇列: ${item.fileInfo.fileName}`,
              {
                attempts: item.attempts,
                maxAttempts: config.processing.retryAttempts,
              }
            );
          }
        }
      }

      logger.logProcessing(
        "BATCH_COMPLETE",
        `批次處理完成: ${batch.length} 個檔案`
      );
    } catch (error) {
      logger.logError("批次處理發生錯誤", error);
    }
  }

  /**
   * 處理單一檔案
   * @param {Object} item - 檔案項目
   */
  async processFile(item) {
    const startTime = Date.now();
    const { eventType, filePath, fileInfo } = item;

    try {
      logger.logProcessing(
        "FILE_PROCESS",
        `開始處理檔案: ${fileInfo.fileName}`,
        {
          eventType: eventType,
          fileSize: fileInfo.fileSize,
        }
      );

      if (eventType === "delete") {
        // 處理檔案刪除
        await this.handleFileDelete(filePath);
      } else {
        // 處理檔案新增或修改
        await this.handleFileAddOrChange(filePath, fileInfo, eventType);
      }

      const processingTime = Date.now() - startTime;
      logger.logPerformance("FILE_PROCESS", processingTime, {
        fileName: fileInfo.fileName,
        eventType: eventType,
      });
    } catch (error) {
      logger.logError(`檔案處理失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理檔案刪除
   * @param {string} filePath - 檔案路徑
   */
  async handleFileDelete(filePath) {
    try {
      // 更新資料庫中的文件狀態
      await dbConnection.query(
        "UPDATE kess_documents SET processing_status = 'deleted', updated_at = NOW() WHERE file_path = ?",
        [filePath]
      );

      logger.logProcessing("FILE_DELETE", `檔案刪除處理完成: ${filePath}`);
    } catch (error) {
      logger.logError(`處理檔案刪除失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 處理檔案新增或修改
   * @param {string} filePath - 檔案路徑
   * @param {Object} fileInfo - 檔案資訊
   * @param {string} eventType - 事件類型
   */
  async handleFileAddOrChange(filePath, fileInfo, eventType) {
    try {
      // 1. 使用文件處理器處理檔案
      const documentData = await this.documentProcessor.processFile(
        filePath,
        fileInfo
      );

      // 2. 儲存或更新文件記錄
      const documentId = await this.saveDocumentRecord(documentData, eventType);

      // 3. 生成摘要
      if (documentData.content && documentData.content.trim().length > 0) {
        await this.summaryService.generateSummary(documentId, documentData);
      }

      logger.logProcessing(
        "FILE_COMPLETE",
        `檔案處理完成: ${fileInfo.fileName}`,
        {
          documentId: documentId,
          contentLength: documentData.content ? documentData.content.length : 0,
        }
      );
    } catch (error) {
      logger.logError(`處理檔案新增/修改失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 根據檔案路徑和內容判斷分類
   * @param {string} filePath - 檔案路徑
   * @param {string} content - 檔案內容
   * @returns {Promise<number>} 分類 ID
   */
  async getCategoryId(filePath, content = "") {
    try {
      // 預設使用通用分類
      let categoryCode = "GENERAL";

      // 根據檔案路徑判斷分類
      const pathLower = filePath.toLowerCase();
      if (
        pathLower.includes("品質") ||
        pathLower.includes("quality") ||
        pathLower.includes("qa")
      ) {
        categoryCode = "QA";
      } else if (
        pathLower.includes("製造") ||
        pathLower.includes("manufacturing") ||
        pathLower.includes("生產")
      ) {
        categoryCode = "MFG";
      } else if (
        pathLower.includes("資訊") ||
        pathLower.includes("it") ||
        pathLower.includes("系統")
      ) {
        categoryCode = "IT";
      } else if (
        pathLower.includes("人資") ||
        pathLower.includes("hr") ||
        pathLower.includes("human")
      ) {
        categoryCode = "HR";
      } else if (
        pathLower.includes("財務") ||
        pathLower.includes("finance") ||
        pathLower.includes("會計")
      ) {
        categoryCode = "FIN";
      } else if (
        pathLower.includes("研發") ||
        pathLower.includes("r&d") ||
        pathLower.includes("開發")
      ) {
        categoryCode = "R&D";
      } else if (
        pathLower.includes("行政") ||
        pathLower.includes("admin") ||
        pathLower.includes("管理")
      ) {
        categoryCode = "ADMIN";
      }

      // 根據內容進一步判斷（如果有內容的話）
      if (content && categoryCode === "GENERAL") {
        const contentLower = content.toLowerCase();
        if (
          contentLower.includes("品質") ||
          contentLower.includes("稽核") ||
          contentLower.includes("檢驗")
        ) {
          categoryCode = "QA";
        } else if (
          contentLower.includes("製造") ||
          contentLower.includes("生產") ||
          contentLower.includes("工程")
        ) {
          categoryCode = "MFG";
        }
      }

      // 查詢分類 ID
      const result = await dbConnection.query(
        "SELECT id FROM kess_categories WHERE category_code = ? AND is_active = TRUE",
        [categoryCode]
      );

      if (result && result.length > 0) {
        return result[0].id;
      } else {
        // 如果找不到分類，使用通用分類
        const fallbackResult = await dbConnection.query(
          "SELECT id FROM kess_categories WHERE category_code = 'GENERAL' AND is_active = TRUE"
        );
        return fallbackResult && fallbackResult.length > 0
          ? fallbackResult[0].id
          : 1;
      }
    } catch (error) {
      logger.logError("取得分類 ID 失敗", error);
      return 1; // 預設返回 ID 1
    }
  }

  /**
   * 儲存文件記錄
   * @param {Object} documentData - 文件資料
   * @param {string} eventType - 事件類型
   * @returns {number} 文件 ID
   */
  async saveDocumentRecord(documentData, eventType) {
    try {
      // 取得分類 ID
      const categoryId = await this.getCategoryId(
        documentData.filePath,
        documentData.contentPreview
      );

      // 檢查文件是否已存在
      const existing = await dbConnection.query(
        "SELECT id FROM kess_documents WHERE file_path = ? AND file_hash = ?",
        [documentData.filePath, documentData.fileHash || null]
      );

      // 確保所有數據庫欄位都有有效值，避免 undefined
      const safeDocumentData = {
        categoryId: categoryId || 1,
        filePath: documentData.filePath || null,
        fileName: documentData.fileName || null,
        fileExtension: documentData.fileExtension || null,
        fileSize:
          typeof documentData.fileSize === "number"
            ? documentData.fileSize
            : null,
        fileHash: documentData.fileHash || null,
        fileModifiedTime:
          documentData.fileModifiedTime instanceof Date
            ? documentData.fileModifiedTime
            : null,
        contentPreview: documentData.contentPreview || null,
        wordCount:
          typeof documentData.wordCount === "number"
            ? documentData.wordCount
            : 0,
      };

      if (existing.length > 0) {
        // 更新現有記錄
        await dbConnection.query(
          `
          UPDATE kess_documents SET 
            category_id = ?,
            file_modified_time = ?,
            content_preview = ?,
            word_count = ?,
            processing_status = 'completed',
            updated_at = NOW()
          WHERE id = ?
        `,
          [
            safeDocumentData.categoryId,
            safeDocumentData.fileModifiedTime,
            safeDocumentData.contentPreview,
            safeDocumentData.wordCount,
            existing[0].id,
          ]
        );

        return existing[0].id;
      } else {
        // 新增記錄
        const result = await dbConnection.query(
          `
          INSERT INTO kess_documents (
            category_id, file_path, original_path, file_name, file_extension, file_size, file_hash,
            file_modified_time, content_preview, word_count, processing_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        `,
          [
            safeDocumentData.categoryId,
            safeDocumentData.filePath,
            safeDocumentData.filePath, // original_path 同 file_path
            safeDocumentData.fileName,
            safeDocumentData.fileExtension,
            safeDocumentData.fileSize,
            safeDocumentData.fileHash,
            safeDocumentData.fileModifiedTime,
            safeDocumentData.contentPreview,
            safeDocumentData.wordCount,
          ]
        );

        return result.insertId;
      }
    } catch (error) {
      logger.logError("儲存文件記錄失敗", error);
      throw error;
    }
  }

  /**
   * 關閉應用程式
   */
  async shutdown() {
    try {
      logger.info("正在關閉 KESS 系統...");

      this.isRunning = false;

      // 停止檔案監控
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatching();
      }

      // 等待處理佇列完成
      let waitCount = 0;
      while (this.processingQueue.length > 0 && waitCount < 30) {
        logger.info(
          `等待處理佇列完成... 剩餘: ${this.processingQueue.length} 個檔案`
        );
        await this.delay(1000);
        waitCount++;
      }

      // 關閉資料庫連線
      if (dbConnection.isReady()) {
        await dbConnection.close();
      }

      logger.info("KESS 系統已關閉");
      process.exit(0);
    } catch (error) {
      logger.logError("系統關閉時發生錯誤", error);
      process.exit(1);
    }
  }

  /**
   * 記錄系統狀態
   */
  async logSystemStatus() {
    const watchFolders = await this.categoryService.getWatchFolders();

    const status = {
      isRunning: this.isRunning,
      fileWatcher: this.fileWatcher ? this.fileWatcher.getStatus() : null,
      processingQueue: {
        length: this.processingQueue.length,
        isProcessing: this.isProcessing,
      },
      config: {
        watchFolders: watchFolders,
        llmProvider: config.llm.provider,
        realtimeMonitoring: config.processing.enableRealTimeMonitoring,
      },
    };

    logger.logProcessing("SYSTEM_STATUS", "系統狀態", status);
  }

  /**
   * 設定網路磁碟機
   */
  async setupNetworkDrives() {
    try {
      logger.info("設定網路磁碟機...");

      // 檢查是否在 Windows 環境
      if (process.platform !== "win32") {
        logger.warn("非 Windows 環境，目前僅支援 Windows 原生 SMB 掛載");
        logger.info(
          "建議在 Linux/macOS 環境下使用系統內建的 CIFS/SMB 掛載功能"
        );
        return;
      }

      // 檢查是否有網路路徑配置
      if (
        !config.monitoring.networkPaths ||
        config.monitoring.networkPaths.length === 0
      ) {
        logger.info("未配置網路路徑，跳過網路磁碟機設定");
        return;
      }

      // 使用跨平台網路監控器
      if (this.networkMonitor) {
        // 設定事件監聽器
        this.networkMonitor.on("fileEvent", async (eventData) => {
          await this.handleFileEvent(eventData);
        });

        this.networkMonitor.on("error", (error) => {
          logger.logError("網路監控器發生錯誤", error);
        });

        // 開始監控網路路徑
        logger.info(
          `準備監控 ${config.monitoring.networkPaths.length} 個網路路徑`
        );
        await this.networkMonitor.startMonitoring(
          config.monitoring.networkPaths
        );
        logger.info(`網路磁碟機設定完成 (${process.platform})`);
      } else {
        logger.warn("網路監控器未初始化");
      }
    } catch (error) {
      logger.logError("設定網路磁碟機失敗", error);
      // 不要拋出錯誤，讓系統繼續運行
    }
  }

  /**
   * 關閉應用程式
   */
  async shutdown() {
    try {
      logger.info("正在關閉 KESS 系統...");

      this.isRunning = false;

      // 停止檔案監控
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatching();
      }

      // 停止網路監控器
      if (this.networkMonitor) {
        await this.networkMonitor.stopMonitoring();
        logger.info("網路監控器已停止");
      }

      // 等待處理佇列完成
      const maxWaitTime = 30000; // 30秒
      const startTime = Date.now();
      while (this.isProcessing && Date.now() - startTime < maxWaitTime) {
        logger.info("等待處理佇列完成...");
        await this.delay(1000);
      }

      // 關閉資料庫連線
      if (dbConnection && dbConnection.connection) {
        await dbConnection.close();
      }

      logger.info("KESS 系統已安全關閉");
    } catch (error) {
      logger.logError("關閉系統時發生錯誤", error);
    }
  }

  /**
   * 延遲函數
   * @param {number} ms - 延遲毫秒數
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = KessApplication;
