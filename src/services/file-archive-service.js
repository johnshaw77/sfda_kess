const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");
const dbConnection = require("../database/connection");

class FileArchiveService {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * 根據功能類別歸檔檔案
   * @param {number} documentId - 文件 ID
   * @param {number} categoryId - 功能類別 ID
   * @param {string} originalPath - 原始檔案路徑
   */
  async archiveFile(documentId, categoryId, originalPath) {
    try {
      logger.logProcessing(
        "ARCHIVE_START",
        `開始歸檔檔案: ${path.basename(originalPath)}`
      );

      // 1. 取得功能類別資訊
      const category = await this.getCategoryInfo(categoryId);
      if (!category) {
        throw new Error(`找不到功能類別: ${categoryId}`);
      }

      // 2. 建立歸檔路徑
      const archivePath = await this.createArchivePath(originalPath, category);

      // 3. 複製檔案到歸檔位置
      await this.copyFileToArchive(originalPath, archivePath);

      // 4. 更新資料庫記錄
      await this.updateDocumentArchiveInfo(documentId, archivePath);

      // 5. 刪除原始檔案（可選）
      await this.deleteOriginalFile(originalPath);

      logger.logProcessing(
        "ARCHIVE_COMPLETE",
        `檔案歸檔完成: ${path.basename(archivePath)}`
      );

      return {
        success: true,
        archivePath: archivePath,
        category: category.category_name,
      };
    } catch (error) {
      logger.logError(`檔案歸檔失敗: ${originalPath}`, error);
      throw error;
    }
  }

  /**
   * 批次歸檔已完成處理的檔案
   * @param {number} batchSize - 批次大小
   */
  async batchArchiveCompletedFiles(batchSize = 10) {
    if (this.isProcessing) {
      logger.warn("歸檔程序已在執行中");
      return;
    }

    try {
      this.isProcessing = true;
      logger.logProcessing("BATCH_ARCHIVE_START", "開始批次歸檔已完成的檔案");

      // 取得需要歸檔的檔案
      const filesToArchive = await dbConnection.query(
        `
        SELECT d.id, d.category_id, d.original_path, d.file_name, c.category_name
        FROM kess_documents d
        JOIN kess_categories c ON d.category_id = c.id
        WHERE d.processing_status = 'completed' 
        AND d.is_archived = FALSE
        AND d.archive_path IS NULL
        ORDER BY d.created_at ASC
        LIMIT ?
      `,
        [batchSize]
      );

      if (filesToArchive.length === 0) {
        logger.logProcessing("BATCH_ARCHIVE_COMPLETE", "沒有需要歸檔的檔案");
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const file of filesToArchive) {
        try {
          await this.archiveFile(file.id, file.category_id, file.original_path);
          successCount++;
        } catch (error) {
          logger.logError(`批次歸檔失敗: ${file.file_name}`, error);
          failureCount++;
        }
      }

      logger.logProcessing("BATCH_ARCHIVE_COMPLETE", `批次歸檔完成`, {
        totalFiles: filesToArchive.length,
        successCount: successCount,
        failureCount: failureCount,
      });
    } catch (error) {
      logger.logError("批次歸檔程序發生錯誤", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 取得功能類別資訊
   * @param {number} categoryId - 功能類別 ID
   * @returns {Object} 功能類別資訊
   */
  async getCategoryInfo(categoryId) {
    const result = await dbConnection.query(
      "SELECT * FROM kess_categories WHERE id = ? AND is_active = TRUE",
      [categoryId]
    );
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 建立歸檔路徑
   * @param {string} originalPath - 原始檔案路徑
   * @param {Object} category - 功能類別資訊
   * @returns {string} 歸檔路徑
   */
  async createArchivePath(originalPath, category) {
    const fileName = path.basename(originalPath);
    const fileExtension = path.extname(fileName);
    const baseName = path.basename(fileName, fileExtension);

    // 建立日期資料夾結構：archive/category/YYYY/MM/
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const archiveDir = path.join(
      category.archive_folder ||
        `./archive/${category.category_code.toLowerCase()}`,
      String(year),
      month
    );

    // 確保歸檔目錄存在
    await fs.ensureDir(archiveDir);

    // 建立唯一檔案名稱（避免重複）
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const uniqueFileName = `${baseName}_${timestamp}${fileExtension}`;

    return path.join(archiveDir, uniqueFileName);
  }

  /**
   * 複製檔案到歸檔位置
   * @param {string} sourcePath - 來源路徑
   * @param {string} archivePath - 歸檔路徑
   */
  async copyFileToArchive(sourcePath, archivePath) {
    try {
      // 檢查來源檔案是否存在
      if (!(await fs.pathExists(sourcePath))) {
        throw new Error(`來源檔案不存在: ${sourcePath}`);
      }

      // 複製檔案
      await fs.copy(sourcePath, archivePath);

      // 驗證複製是否成功
      if (!(await fs.pathExists(archivePath))) {
        throw new Error(`歸檔檔案建立失敗: ${archivePath}`);
      }

      logger.logProcessing(
        "FILE_COPY",
        `檔案複製成功: ${sourcePath} -> ${archivePath}`
      );
    } catch (error) {
      logger.logError(`檔案複製失敗: ${sourcePath}`, error);
      throw error;
    }
  }

  /**
   * 更新文件歸檔資訊
   * @param {number} documentId - 文件 ID
   * @param {string} archivePath - 歸檔路徑
   */
  async updateDocumentArchiveInfo(documentId, archivePath) {
    try {
      await dbConnection.query(
        `
        UPDATE kess_documents SET 
          archive_path = ?,
          is_archived = TRUE,
          archived_at = NOW(),
          processing_status = 'archived',
          updated_at = NOW()
        WHERE id = ?
      `,
        [archivePath, documentId]
      );

      logger.logProcessing("DB_UPDATE", `更新文件歸檔資訊: ${documentId}`);
    } catch (error) {
      logger.logError(`更新歸檔資訊失敗: ${documentId}`, error);
      throw error;
    }
  }

  /**
   * 刪除原始檔案
   * @param {string} originalPath - 原始檔案路徑
   * @param {boolean} forceDelete - 是否強制刪除
   */
  async deleteOriginalFile(originalPath, forceDelete = false) {
    try {
      if (!forceDelete) {
        // 預設不刪除原始檔案，只記錄
        logger.logProcessing("FILE_KEEP", `保留原始檔案: ${originalPath}`);
        return;
      }

      if (await fs.pathExists(originalPath)) {
        await fs.remove(originalPath);
        logger.logProcessing("FILE_DELETE", `刪除原始檔案: ${originalPath}`);
      }
    } catch (error) {
      logger.logError(`刪除原始檔案失敗: ${originalPath}`, error);
      // 不拋出錯誤，因為歸檔已經成功
    }
  }

  /**
   * 根據功能類別取得歸檔統計
   * @param {string} categoryCode - 功能代碼
   * @returns {Object} 歸檔統計
   */
  async getArchiveStatistics(categoryCode = null) {
    try {
      let sql = `
        SELECT 
          c.category_code,
          c.category_name,
          COUNT(d.id) as total_documents,
          COUNT(CASE WHEN d.is_archived = TRUE THEN 1 END) as archived_count,
          COUNT(CASE WHEN d.is_archived = FALSE THEN 1 END) as pending_archive_count,
          SUM(CASE WHEN d.is_archived = TRUE THEN d.file_size ELSE 0 END) as archived_size,
          MAX(d.archived_at) as last_archived_time
        FROM kess_categories c
        LEFT JOIN kess_documents d ON c.id = d.category_id
        WHERE c.is_active = TRUE
      `;

      const params = [];
      if (categoryCode) {
        sql += " AND c.category_code = ?";
        params.push(categoryCode);
      }

      sql +=
        " GROUP BY c.id, c.category_code, c.category_name ORDER BY c.sort_order";

      const results = await dbConnection.query(sql, params);
      return results;
    } catch (error) {
      logger.logError("取得歸檔統計失敗", error);
      throw error;
    }
  }

  /**
   * 清理過期的歸檔檔案
   * @param {number} daysToKeep - 保留天數
   * @param {string} categoryCode - 功能代碼（可選）
   */
  async cleanupOldArchives(daysToKeep = 365, categoryCode = null) {
    try {
      logger.logProcessing(
        "CLEANUP_START",
        `開始清理 ${daysToKeep} 天前的歸檔檔案`
      );

      let sql = `
        SELECT d.id, d.archive_path, c.category_name
        FROM kess_documents d
        JOIN kess_categories c ON d.category_id = c.id
        WHERE d.is_archived = TRUE 
        AND d.archived_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const params = [daysToKeep];
      if (categoryCode) {
        sql += " AND c.category_code = ?";
        params.push(categoryCode);
      }

      const oldArchives = await dbConnection.query(sql, params);

      let deletedCount = 0;
      for (const archive of oldArchives) {
        try {
          if (await fs.pathExists(archive.archive_path)) {
            await fs.remove(archive.archive_path);
            deletedCount++;
          }

          // 更新資料庫記錄（標記為已清理）
          await dbConnection.query(
            "UPDATE kess_documents SET archive_path = NULL WHERE id = ?",
            [archive.id]
          );
        } catch (error) {
          logger.logError(`清理歸檔檔案失敗: ${archive.archive_path}`, error);
        }
      }

      logger.logProcessing("CLEANUP_COMPLETE", `歸檔清理完成`, {
        targetFiles: oldArchives.length,
        deletedCount: deletedCount,
      });
    } catch (error) {
      logger.logError("清理歸檔檔案發生錯誤", error);
      throw error;
    }
  }
}

module.exports = FileArchiveService;
