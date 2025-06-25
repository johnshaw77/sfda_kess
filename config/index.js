require("dotenv").config();

const config = {
  // 資料庫設定
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || "sfda_nexus",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    timezone: "+08:00",
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
  },

  // LLM 設定
  llm: {
    provider: process.env.LLM_PROVIDER || "local",
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      maxTokens: 1000,
      temperature: 0.7,
    },
    local: {
      url: process.env.LOCAL_LLM_URL || "http://localhost:11434",
      model: process.env.LOCAL_LLM_MODEL || "gemma2:27b",
    },
  },

  // 監控設定
  monitoring: {
    watchFolders: process.env.WATCH_FOLDERS
      ? process.env.WATCH_FOLDERS.split(",")
      : ["./demo-data"],
    // 網路儲存監控設定
    networkPaths: process.env.NETWORK_PATHS
      ? process.env.NETWORK_PATHS.split(",")
      : [],
    enableNetworkMonitoring: process.env.ENABLE_NETWORK_MONITORING === "true",
    pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 5000,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    supportedExtensions: process.env.SUPPORTED_EXTENSIONS
      ? process.env.SUPPORTED_EXTENSIONS.split(",")
      : [".txt", ".md", ".pdf", ".docx", ".xlsx"],
    ignorePatterns: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.DS_Store",
      "**/Thumbs.db",
      "**/*.tmp",
      "**/*.temp",
      "**/.Trash-*/**",
      "**/System Volume Information/**",
      "**/$RECYCLE.BIN/**",
    ],
    // 網路儲存專用設定
    networkStorage: {
      retryAttempts: parseInt(process.env.NETWORK_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.NETWORK_RETRY_DELAY) || 5000,
      connectionTimeout:
        parseInt(process.env.NETWORK_CONNECTION_TIMEOUT) || 30000,
      enableAutoMount: process.env.ENABLE_AUTO_MOUNT !== "false",
      mountTimeout: parseInt(process.env.MOUNT_TIMEOUT) || 60000,
    },
  },

  // 處理設定
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    processingDelay: parseInt(process.env.PROCESSING_DELAY) || 1000,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    enableRealTimeMonitoring: process.env.ENABLE_REALTIME_MONITORING === "true",
    enableScheduledProcessing:
      process.env.ENABLE_SCHEDULED_PROCESSING === "true",
  },

  // 摘要設定
  summary: {
    maxLength: parseInt(process.env.SUMMARY_MAX_LENGTH) || 500,
    language: process.env.SUMMARY_LANGUAGE || "zh-TW",
    extractKeywords: process.env.EXTRACT_KEYWORDS === "true",
    extractEntities: process.env.EXTRACT_ENTITIES === "true",
  },

  // 排程設定
  scheduler: {
    cronSchedule: process.env.CRON_SCHEDULE || "0 */6 * * *", // 每6小時執行一次
  },

  // 檔案歸檔設定
  archiving: {
    enabled: process.env.ENABLE_FILE_ARCHIVING === "true",
    basePath: process.env.ARCHIVE_BASE_PATH || "./demo-data/archived",
    byCategory: process.env.ARCHIVE_BY_CATEGORY === "true",
    byDate: process.env.ARCHIVE_BY_DATE === "true",
    createBackup: process.env.CREATE_BACKUP === "true",
    retryAttempts: parseInt(process.env.ARCHIVE_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.ARCHIVE_RETRY_DELAY) || 1000,
  },

  // 日誌設定
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "./logs/kess.log",
    maxSize: parseInt(process.env.LOG_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
  },
};

module.exports = config;
