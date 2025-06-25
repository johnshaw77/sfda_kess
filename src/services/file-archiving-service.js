const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const config = require("../../config");
const logger = require("../utils/logger");

class FileArchivingService {
  constructor() {
    this.config = config.archiving;
  }

  /**
   * 處理檔案歸檔
   * @param {string} sourceFilePath - 原始檔案路徑
   * @param {Object} documentData - 文件資料
   * @returns {Promise<string>} 歸檔後的檔案路徑
   */
  async archiveFile(sourceFilePath, documentData) {
    if (!this.config.enabled) {
      logger.info("檔案歸檔功能已停用");
      return null;
    }

    try {
      logger.info(`開始歸檔檔案: ${sourceFilePath}`);

      // 建立歸檔路徑
      const archivePath = await this.createArchivePath(documentData);

      // 建立目標檔案名稱
      const targetFileName = await this.createTargetFileName(
        sourceFilePath,
        documentData
      );
      const targetFilePath = path.join(archivePath, targetFileName);

      // 確保目標目錄存在
      await this.ensureDirectoryExists(archivePath);

      // 移動檔案
      await this.moveFileWithRetry(sourceFilePath, targetFilePath);

      logger.info(`檔案歸檔成功: ${targetFilePath}`);
      return targetFilePath;
    } catch (error) {
      logger.logError(`檔案歸檔失敗: ${sourceFilePath}`, error);
      throw error;
    }
  }

  /**
   * 建立歸檔路徑
   * @param {Object} documentData - 文件資料
   * @returns {Promise<string>} 歸檔路徑
   */
  async createArchivePath(documentData) {
    let archivePath = this.config.basePath;

    // 按分類建立資料夾
    if (this.config.byCategory && documentData.category) {
      // 取得分類名稱
      const categoryName = await this.getCategoryName(documentData.categoryId);
      if (categoryName) {
        archivePath = path.join(archivePath, categoryName);
      }
    }

    // 按日期建立資料夾
    if (this.config.byDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      archivePath = path.join(archivePath, String(year), month);
    }

    return path.resolve(archivePath);
  }

  /**
   * 取得分類名稱
   * @param {number} categoryId - 分類 ID
   * @returns {Promise<string>} 分類名稱
   */
  async getCategoryName(categoryId) {
    try {
      const dbConnection = require("../database/connection");
      const connection = await dbConnection.pool.getConnection();

      const [rows] = await connection.execute(
        "SELECT category_name FROM kess_categories WHERE id = ?",
        [categoryId]
      );

      connection.release();

      return rows.length > 0 ? rows[0].name : "未分類";
    } catch (error) {
      logger.logError("取得分類名稱失敗", error);
      return "未分類";
    }
  }

  /**
   * 建立目標檔案名稱
   * @param {string} sourceFilePath - 原始檔案路徑
   * @param {Object} documentData - 文件資料
   * @returns {Promise<string>} 目標檔案名稱
   */
  async createTargetFileName(sourceFilePath, documentData) {
    const originalName = path.basename(sourceFilePath);
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);

    // 加入處理時間戳記
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    // 加入文件 ID
    const documentId = documentData.id || "unknown";

    return `processed_${timestamp}_${documentId}_${nameWithoutExt}${extension}`;
  }

  /**
   * 確保目錄存在
   * @param {string} dirPath - 目錄路徑
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      logger.info(`確保目錄存在: ${dirPath}`);
    } catch (error) {
      logger.logError(`建立目錄失敗: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * 帶重試機制的檔案移動
   * @param {string} sourcePath - 來源路徑
   * @param {string} targetPath - 目標路徑
   */
  async moveFileWithRetry(sourcePath, targetPath) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // 檢查目標檔案是否已存在
        if (await fs.pathExists(targetPath)) {
          // 檔案已存在，加入隨機後綴
          const extension = path.extname(targetPath);
          const nameWithoutExt = targetPath.slice(0, -extension.length);
          const randomSuffix = crypto.randomBytes(4).toString("hex");
          targetPath = `${nameWithoutExt}_${randomSuffix}${extension}`;
        }

        // 移動檔案
        await fs.move(sourcePath, targetPath);
        logger.info(
          `檔案移動成功 (第 ${attempt} 次嘗試): ${sourcePath} -> ${targetPath}`
        );
        return;
      } catch (error) {
        lastError = error;
        logger.logError(
          `檔案移動失敗 (第 ${attempt}/${this.config.retryAttempts} 次嘗試)`,
          error
        );

        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelay * attempt);
        }
      }
    }

    throw new Error(
      `檔案移動失敗，已重試 ${this.config.retryAttempts} 次: ${lastError.message}`
    );
  }

  /**
   * 延遲執行
   * @param {number} ms - 延遲毫秒數
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 建立歸檔記錄
   * @param {number} documentId - 文件 ID
   * @param {string} originalPath - 原始路徑
   * @param {string} archivedPath - 歸檔路徑
   */
  async createArchiveRecord(documentId, originalPath, archivedPath) {
    try {
      const dbConnection = require("../database/connection");
      const connection = await dbConnection.pool.getConnection();

      const sql = `
        INSERT INTO kess_processing_logs (
          document_id, operation_type, status, message, created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `;

      const message = JSON.stringify({
        action: "file_archived",
        original_path: originalPath,
        archived_path: archivedPath,
        archived_at: new Date().toISOString(),
      });

      await connection.execute(sql, [
        documentId,
        "archive",
        "success",
        message,
      ]);

      connection.release();
      logger.info(`歸檔記錄已建立: 文件 ${documentId}`);
    } catch (error) {
      logger.logError(`建立歸檔記錄失敗`, error);
    }
  }
}

module.exports = new FileArchivingService();
