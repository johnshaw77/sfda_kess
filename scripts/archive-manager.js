#!/usr/bin/env node

const path = require("path");
const fs = require("fs-extra");
const fileArchivingService = require("../src/services/file-archiving-service");
const dbConnection = require("../src/database/connection");
const logger = require("../src/utils/logger");

class ArchiveManager {
  /**
   * 查看歸檔統計
   */
  async showArchiveStats() {
    try {
      await dbConnection.initialize();
      const connection = await dbConnection.pool.getConnection();

      const sql = `
        SELECT 
          c.category_name,
          COUNT(d.id) as total_files,
          COUNT(d.archive_path) as archived_files,
          COUNT(d.id) - COUNT(d.archive_path) as pending_files,
          ROUND(SUM(d.file_size) / 1024 / 1024, 2) as total_size_mb
        FROM kess_documents d
        LEFT JOIN kess_categories c ON d.category_id = c.id
        GROUP BY c.category_name
        ORDER BY c.category_name
      `;

      const [results] = await connection.execute(sql);
      connection.release();

      console.log("\n📊 歸檔統計報告");
      console.log("=".repeat(60));

      let totalFiles = 0;
      let totalArchived = 0;

      results.forEach((row) => {
        console.log(`📁 ${row.category_name || "未分類"}`);
        console.log(`   總文件: ${row.total_files}`);
        console.log(`   已歸檔: ${row.archived_files}`);
        console.log(`   待歸檔: ${row.pending_files}`);
        console.log(`   總大小: ${row.total_size_mb || 0} MB`);
        console.log("");

        totalFiles += row.total_files;
        totalArchived += row.archived_files;
      });

      console.log("=".repeat(60));
      console.log(`📈 總計: ${totalFiles} 個文件，已歸檔 ${totalArchived} 個`);
      console.log(
        `📊 歸檔率: ${
          totalFiles > 0 ? Math.round((totalArchived / totalFiles) * 100) : 0
        }%`
      );
    } catch (error) {
      logger.logError("查看歸檔統計失敗", error);
    }
  }

  /**
   * 列出未歸檔的檔案
   */
  async listPendingFiles() {
    try {
      await dbConnection.initialize();
      const connection = await dbConnection.pool.getConnection();

      const sql = `
        SELECT 
          d.id,
          d.file_name,
          d.file_path,
          c.category_name,
          d.created_at
        FROM kess_documents d
        LEFT JOIN kess_categories c ON d.category_id = c.id
        WHERE d.archive_path IS NULL
        ORDER BY d.created_at DESC
      `;

      const [results] = await connection.execute(sql);
      connection.release();

      console.log("\n📋 待歸檔檔案清單");
      console.log("=".repeat(80));

      if (results.length === 0) {
        console.log("✅ 沒有待歸檔的檔案");
        return;
      }

      results.forEach((row, index) => {
        console.log(`${index + 1}. 📄 ${row.file_name}`);
        console.log(`   📁 分類: ${row.category_name || "未分類"}`);
        console.log(`   📍 路徑: ${row.file_path}`);
        console.log(`   📅 建立: ${row.created_at}`);
        console.log("");
      });

      console.log(`📊 共 ${results.length} 個檔案待歸檔`);
    } catch (error) {
      logger.logError("列出待歸檔檔案失敗", error);
    }
  }

  /**
   * 手動歸檔指定檔案
   * @param {number} documentId - 文件 ID
   */
  async manualArchive(documentId) {
    try {
      await dbConnection.initialize();
      const connection = await dbConnection.pool.getConnection();

      // 取得文件資訊
      const [docs] = await connection.execute(
        `SELECT d.*, c.category_name 
         FROM kess_documents d 
         LEFT JOIN kess_categories c ON d.category_id = c.id 
         WHERE d.id = ?`,
        [documentId]
      );

      if (docs.length === 0) {
        console.log(`❌ 找不到文件 ID: ${documentId}`);
        connection.release();
        return;
      }

      const doc = docs[0];

      if (doc.archive_path) {
        console.log(`ℹ️  文件已歸檔: ${doc.archive_path}`);
        connection.release();
        return;
      }

      // 檢查原始檔案是否存在
      if (!(await fs.pathExists(doc.file_path))) {
        console.log(`❌ 原始檔案不存在: ${doc.file_path}`);
        connection.release();
        return;
      }

      console.log(`🚀 開始歸檔: ${doc.file_name}`);

      // 執行歸檔
      const documentData = {
        id: doc.id,
        categoryId: doc.category_id,
        category: doc.category_name,
      };

      const archivedPath = await fileArchivingService.archiveFile(
        doc.file_path,
        documentData
      );

      if (archivedPath) {
        // 更新資料庫
        await connection.execute(
          `UPDATE kess_documents 
           SET archive_path = ?, is_archived = 1, archived_at = NOW() 
           WHERE id = ?`,
          [archivedPath, documentId]
        );

        // 建立歸檔記錄
        await fileArchivingService.createArchiveRecord(
          documentId,
          doc.file_path,
          archivedPath
        );

        console.log(`✅ 歸檔成功: ${archivedPath}`);
      }

      connection.release();
    } catch (error) {
      logger.logError(`手動歸檔失敗 (ID: ${documentId})`, error);
      console.log(`❌ 歸檔失敗: ${error.message}`);
    }
  }

  /**
   * 清理過期的歸檔檔案
   * @param {number} daysOld - 保留天數
   */
  async cleanupOldArchives(daysOld = 90) {
    try {
      await dbConnection.initialize();
      const connection = await dbConnection.pool.getConnection();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      console.log(`\n🧹 清理 ${daysOld} 天前的歸檔檔案...`);
      console.log(`📅 截止日期: ${cutoffDate.toLocaleDateString()}`);

      const sql = `
        SELECT id, file_name, archive_path, created_at 
        FROM kess_documents 
        WHERE archive_path IS NOT NULL 
        AND archived_at < ?
      `;

      const [oldFiles] = await connection.execute(sql, [cutoffDate]);

      if (oldFiles.length === 0) {
        console.log("✅ 沒有需要清理的檔案");
        connection.release();
        return;
      }

      console.log(`📋 找到 ${oldFiles.length} 個過期歸檔檔案`);

      let deletedCount = 0;
      for (const file of oldFiles) {
        try {
          if (file.archive_path && (await fs.pathExists(file.archive_path))) {
            await fs.remove(file.archive_path);
            deletedCount++;
            console.log(`✅ 已刪除: ${file.file_name}`);
          }
        } catch (error) {
          console.log(`❌ 刪除失敗: ${file.file_name} - ${error.message}`);
        }
      }

      connection.release();
      console.log(`\n🎯 清理完成: 刪除了 ${deletedCount} 個檔案`);
    } catch (error) {
      logger.logError("清理歸檔檔案失敗", error);
    }
  }
}

// 命令列介面
async function main() {
  const archiveManager = new ArchiveManager();
  const command = process.argv[2];
  const param = process.argv[3];

  try {
    switch (command) {
      case "stats":
        await archiveManager.showArchiveStats();
        break;
      case "list":
        await archiveManager.listPendingFiles();
        break;
      case "archive":
        if (!param) {
          console.log("❌ 請提供文件 ID");
          return;
        }
        await archiveManager.manualArchive(parseInt(param));
        break;
      case "cleanup":
        const days = parseInt(param) || 90;
        await archiveManager.cleanupOldArchives(days);
        break;
      default:
        console.log(`
📁 歸檔管理工具

使用方式:
  node scripts/archive-manager.js stats              # 查看歸檔統計
  node scripts/archive-manager.js list               # 列出待歸檔檔案
  node scripts/archive-manager.js archive <ID>       # 手動歸檔指定檔案
  node scripts/archive-manager.js cleanup [天數]      # 清理過期檔案 (預設90天)

範例:
  node scripts/archive-manager.js stats
  node scripts/archive-manager.js list
  node scripts/archive-manager.js archive 123
  node scripts/archive-manager.js cleanup 30
        `);
    }
  } catch (error) {
    console.error("❌ 執行失敗:", error.message);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = ArchiveManager;
