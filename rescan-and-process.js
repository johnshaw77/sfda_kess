/**
 * KESS 重新掃描與處理腳本
 * 重新掃描所有監控資料夾中的檔案，並處理新增或異動的檔案
 */

const mysql = require("mysql2/promise");
const config = require("./config");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

async function getFileHash(filePath) {
  try {
    const data = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(data).digest("hex");
  } catch (error) {
    console.error(`無法計算檔案雜湊: ${filePath}`, error);
    return null;
  }
}

async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      modifiedTime: stats.mtime,
      isFile: stats.isFile(),
    };
  } catch (error) {
    console.error(`無法取得檔案資訊: ${filePath}`, error);
    return null;
  }
}

async function scanDirectory(
  dirPath,
  extensions = [".txt", ".md", ".pdf", ".docx", ".doc", ".xlsx", ".rtf"]
) {
  const files = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        // 遞迴掃描子目錄
        const subFiles = await scanDirectory(fullPath, extensions);
        files.push(...subFiles);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext)) {
          const fileStats = await getFileStats(fullPath);
          if (fileStats && fileStats.isFile) {
            files.push({
              path: fullPath,
              name: item.name,
              extension: ext,
              size: fileStats.size,
              modifiedTime: fileStats.modifiedTime,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`掃描目錄失敗: ${dirPath}`, error);
  }

  return files;
}

async function resetProcessingStatus() {
  const connection = await mysql.createConnection(config.database);

  try {
    console.log("🔄 重設所有文件處理狀態為 pending...");

    // 重設所有文件狀態為 pending，但保留摘要資料
    const [result] = await connection.execute(`
      UPDATE kess_documents 
      SET processing_status = 'pending',
          is_archived = FALSE,
          archived_at = NULL,
          updated_at = NOW()
      WHERE processing_status = 'completed'
    `);

    console.log(`✅ 已重設 ${result.affectedRows} 個文件的處理狀態`);
  } finally {
    await connection.end();
  }
}

async function rescanAndProcess() {
  const connection = await mysql.createConnection(config.database);

  try {
    console.log("🔍 開始重新掃描所有監控資料夾...\n");

    // 取得所有監控資料夾
    const watchFolders = config.monitoring.watchFolders;
    const supportedExtensions = config.monitoring.supportedExtensions;

    console.log("📂 監控資料夾:", watchFolders);
    console.log("📄 支援的檔案類型:", supportedExtensions);
    console.log("");

    let totalNewFiles = 0;
    let totalUpdatedFiles = 0;
    let totalSkippedFiles = 0;

    for (const folder of watchFolders) {
      console.log(`📁 掃描資料夾: ${folder}`);

      const files = await scanDirectory(folder, supportedExtensions);
      console.log(`   找到 ${files.length} 個檔案`);

      for (const file of files) {
        // 檢查檔案是否已存在於資料庫
        const [existing] = await connection.execute(
          `
          SELECT id, file_hash, file_modified_time, processing_status 
          FROM kess_documents 
          WHERE file_path = ?
        `,
          [file.path]
        );

        const fileHash = await getFileHash(file.path);
        if (!fileHash) continue;

        if (existing.length === 0) {
          // 新檔案，需要加入資料庫
          console.log(`   📄 新檔案: ${file.name}`);

          // 使用路徑對應確定分類
          const categoryId = await getCategoryForPath(connection, file.path);

          await connection.execute(
            `
            INSERT INTO kess_documents (
              category_id, file_path, original_path, file_name, file_extension,
              file_size, file_hash, file_modified_time, processing_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
          `,
            [
              categoryId,
              file.path,
              file.path,
              file.name,
              file.extension,
              file.size,
              fileHash,
              file.modifiedTime,
            ]
          );

          totalNewFiles++;
        } else {
          const existingDoc = existing[0];

          // 檢查檔案是否有異動
          if (
            existingDoc.file_hash !== fileHash ||
            new Date(existingDoc.file_modified_time).getTime() !==
              file.modifiedTime.getTime()
          ) {
            console.log(`   🔄 檔案已異動: ${file.name}`);

            // 更新檔案資訊並重設處理狀態
            await connection.execute(
              `
              UPDATE kess_documents 
              SET file_size = ?, file_hash = ?, file_modified_time = ?, 
                  processing_status = 'pending', updated_at = NOW()
              WHERE id = ?
            `,
              [file.size, fileHash, file.modifiedTime, existingDoc.id]
            );

            totalUpdatedFiles++;
          } else {
            // 檔案沒有異動
            if (existingDoc.processing_status === "completed") {
              totalSkippedFiles++;
            } else {
              // 檔案沒異動但處理狀態不是完成，重設為 pending
              await connection.execute(
                `
                UPDATE kess_documents 
                SET processing_status = 'pending', updated_at = NOW()
                WHERE id = ?
              `,
                [existingDoc.id]
              );
              totalUpdatedFiles++;
            }
          }
        }
      }

      console.log(`   ✅ ${folder} 掃描完成\n`);
    }

    console.log("📊 掃描結果統計:");
    console.log(`   新檔案: ${totalNewFiles}`);
    console.log(`   異動檔案: ${totalUpdatedFiles}`);
    console.log(`   跳過檔案: ${totalSkippedFiles}`);

    // 檢查等待處理的檔案數量
    const [pendingCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM kess_documents WHERE processing_status = 'pending'
    `);

    console.log(`\n🎯 待處理檔案數量: ${pendingCount[0].count}`);

    if (pendingCount[0].count > 0) {
      console.log("\n💡 提示:");
      console.log("   現在可以啟動 KESS 系統來處理這些檔案:");
      console.log("   npm start");
      console.log("   或");
      console.log("   node src/start.js");
    } else {
      console.log("\n✨ 所有檔案都已是最新狀態，無需重新處理");
    }
  } finally {
    await connection.end();
  }
}

async function getCategoryForPath(connection, filePath) {
  // 使用 watch_folder 對應分類
  const [categories] = await connection.execute(`
    SELECT id, watch_folder FROM kess_categories WHERE is_active = TRUE ORDER BY id
  `);

  for (const category of categories) {
    if (category.watch_folder && filePath.includes(category.watch_folder)) {
      return category.id;
    }
  }

  // 如果沒有匹配，返回通用類別
  const [defaultCategory] = await connection.execute(`
    SELECT id FROM kess_categories WHERE category_name = '通用類別' AND is_active = TRUE
  `);

  return defaultCategory.length > 0 ? defaultCategory[0].id : 1;
}

// 命令列參數處理
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes("--reset-status")) {
      await resetProcessingStatus();
    } else {
      await rescanAndProcess();
    }

    console.log("\n🎉 重新掃描完成！");
  } catch (error) {
    console.error("❌ 執行失敗:", error);
    process.exit(1);
  }
}

// 如果是直接執行此腳本
if (require.main === module) {
  console.log("KESS 重新掃描與處理工具");
  console.log("============================\n");

  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("使用方式:");
    console.log(
      "  node rescan-and-process.js              重新掃描並標記需處理的檔案"
    );
    console.log(
      "  node rescan-and-process.js --reset-status   重設所有文件狀態為待處理"
    );
    console.log("");
    console.log("注意: 此腳本只會標記檔案需要處理，實際處理需要啟動 KESS 系統");
    process.exit(0);
  }

  main();
}

module.exports = { rescanAndProcess, resetProcessingStatus };
