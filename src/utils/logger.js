const winston = require("winston");
const path = require("path");
const fs = require("fs");
const config = require("../../config");

// 確保日誌目錄存在
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 定義日誌格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // 如果有額外的 metadata，添加到日誌中
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    // 如果有錯誤堆疊，添加到日誌中
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// 建立 logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // 控制台輸出
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),

    // 一般日誌檔案
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true,
    }),

    // 錯誤日誌檔案
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true,
    }),
  ],

  // 處理未捕獲的異常
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],

  // 處理未處理的 Promise 拒絕
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
    }),
  ],
});

// 擴展 logger 功能
logger.logWithContext = function (level, message, context = {}) {
  this.log(level, message, {
    context: context,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
};

logger.logError = function (message, error, context = {}) {
  this.error(message, {
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
    context: context,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
};

logger.logProcessing = function (stage, message, data = {}) {
  this.info(`[${stage}] ${message}`, {
    processing_stage: stage,
    data: data,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
};

logger.logPerformance = function (operation, duration, additional = {}) {
  this.info(`Performance: ${operation} completed in ${duration}ms`, {
    operation: operation,
    duration_ms: duration,
    performance: true,
    ...additional,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
};

// 設定全域錯誤處理
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

module.exports = logger;
