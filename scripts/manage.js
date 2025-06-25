#!/usr/bin/env node

/**
 * KESS 系統管理工具
 */

const dbConnection = require("../src/database/connection");
const logger = require("../src/utils/logger");

class KessManager {
  constructor() {
    this.commands = {
      status: this.showStatus.bind(this),
      stats: this.showStatistics.bind(this),
      cleanup: this.cleanupOldData.bind(this),
      reset: this.resetDatabase.bind(this),
      export: this.exportData.bind(this),
      help: this.showHelp.bind(this),
    };
  }

  /**
   * 執行命令
   */
  async run(command, ...args) {
    try {
      await dbConnection.initialize();

      if (!this.commands[command]) {
        console.log(`❌ 未知命令: ${command}`);
        this.showHelp();
        return;
      }

      await this.commands[command](...args);
    } catch (error) {
      console.error("❌ 執行失敗:", error.message);
      process.exit(1);
    } finally {
      if (dbConnection.isReady()) {
        await dbConnection.close();
      }
    }
  }

  /**
   * 顯示系統狀態
   */
  async showStatus() {
    console.log("📊 KESS 系統狀態");
    console.log("=".repeat(40));

    try {
      // 文件統計
      const [docStats] = await dbConnection.query(`
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed,
          SUM(file_size) as total_size
        FROM kess_documents
      `);

      // 摘要統計
      const [summaryStats] = await dbConnection.query(`
        SELECT 
          COUNT(*) as total_summaries,
          AVG(confidence_score) as avg_confidence,
          COUNT(DISTINCT llm_provider) as providers_used
        FROM kess_summaries
      `);

      // 最近活動
      const recentActivity = await dbConnection.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM kess_documents 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `);

      console.log(`📄 文件統計:`);
      console.log(`  總文件數: ${docStats.total_documents || 0}`);
      console.log(`  已處理: ${docStats.completed || 0}`);
      console.log(`  待處理: ${docStats.pending || 0}`);
      console.log(`  失敗: ${docStats.failed || 0}`);
      console.log(`  總大小: ${this.formatFileSize(docStats.total_size || 0)}`);

      console.log(`\n📝 摘要統計:`);
      console.log(`  總摘要數: ${summaryStats.total_summaries || 0}`);
      console.log(
        `  平均可信度: ${(summaryStats.avg_confidence || 0).toFixed(2)}`
      );
      console.log(`  使用的 LLM 提供者: ${summaryStats.providers_used || 0}`);

      console.log(`\n📈 最近 7 天活動:`);
      recentActivity.forEach((item) => {
        console.log(`  ${item.date}: ${item.count} 個文件`);
      });
    } catch (error) {
      console.error("❌ 取得狀態失敗:", error.message);
    }
  }

  /**
   * 顯示詳細統計
   */
  async showStatistics() {
    console.log("📈 KESS 詳細統計");
    console.log("=".repeat(40));

    try {
      // 檔案類型統計
      const fileTypeStats = await dbConnection.query(`
        SELECT 
          file_extension,
          COUNT(*) as count,
          AVG(file_size) as avg_size,
          SUM(file_size) as total_size
        FROM kess_documents 
        GROUP BY file_extension 
        ORDER BY count DESC
      `);

      // LLM 提供者統計
      const llmStats = await dbConnection.query(`
        SELECT 
          llm_provider,
          llm_model,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_time,
          AVG(confidence_score) as avg_confidence
        FROM kess_summaries 
        GROUP BY llm_provider, llm_model 
        ORDER BY count DESC
      `);

      // 處理效能統計
      const performanceStats = await dbConnection.query(`
        SELECT 
          DATE(s.created_at) as date,
          COUNT(*) as summaries_generated,
          AVG(s.processing_time_ms) as avg_processing_time,
          AVG(d.file_size) as avg_file_size
        FROM kess_summaries s
        JOIN kess_documents d ON s.document_id = d.id
        WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(s.created_at)
        ORDER BY date DESC
        LIMIT 10
      `);

      console.log(`📁 檔案類型分佈:`);
      fileTypeStats.forEach((stat) => {
        console.log(
          `  ${stat.file_extension}: ${
            stat.count
          } 個檔案 (平均大小: ${this.formatFileSize(stat.avg_size)})`
        );
      });

      console.log(`\n🤖 LLM 使用統計:`);
      llmStats.forEach((stat) => {
        console.log(
          `  ${stat.llm_provider}/${stat.llm_model}: ${stat.count} 次處理`
        );
        console.log(`    平均處理時間: ${Math.round(stat.avg_time)}ms`);
        console.log(`    平均可信度: ${stat.avg_confidence.toFixed(2)}`);
      });

      console.log(`\n⚡ 最近 30 天效能:`);
      performanceStats.forEach((stat) => {
        console.log(`  ${stat.date}: ${stat.summaries_generated} 個摘要`);
        console.log(
          `    平均處理時間: ${Math.round(stat.avg_processing_time)}ms`
        );
        console.log(
          `    平均檔案大小: ${this.formatFileSize(stat.avg_file_size)}`
        );
      });
    } catch (error) {
      console.error("❌ 取得統計失敗:", error.message);
    }
  }

  /**
   * 清理舊資料
   */
  async cleanupOldData(days = 90) {
    console.log(`🧹 清理 ${days} 天前的舊資料...`);

    try {
      // 清理處理日誌
      const logsResult = await dbConnection.query(
        "DELETE FROM kess_processing_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
        [days]
      );

      // 清理失敗的文件記錄
      const failedResult = await dbConnection.query(
        "DELETE FROM kess_documents WHERE processing_status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
        [days]
      );

      console.log(`✅ 清理完成:`);
      console.log(`  刪除處理日誌: ${logsResult.affectedRows} 筆`);
      console.log(`  刪除失敗記錄: ${failedResult.affectedRows} 筆`);
    } catch (error) {
      console.error("❌ 清理失敗:", error.message);
    }
  }

  /**
   * 重置資料庫
   */
  async resetDatabase() {
    console.log("⚠️  即將重置資料庫，這將刪除所有資料！");

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question("確定要繼續嗎？請輸入 'RESET' 確認: ", resolve);
    });

    rl.close();

    if (answer !== "RESET") {
      console.log("❌ 取消重置");
      return;
    }

    try {
      // 刪除所有資料
      await dbConnection.query("DELETE FROM kess_summaries");
      await dbConnection.query("DELETE FROM kess_processing_logs");
      await dbConnection.query("DELETE FROM kess_documents");
      await dbConnection.query("DELETE FROM kess_watched_folders");

      console.log("✅ 資料庫重置完成");
    } catch (error) {
      console.error("❌ 重置失敗:", error.message);
    }
  }

  /**
   * 匯出資料
   */
  async exportData(format = "json") {
    console.log(`📤 匯出資料 (格式: ${format})...`);

    try {
      const data = {
        documents: await dbConnection.query("SELECT * FROM kess_documents"),
        summaries: await dbConnection.query(`
          SELECT s.*, d.file_name, d.file_path 
          FROM kess_summaries s 
          JOIN kess_documents d ON s.document_id = d.id
        `),
        statistics: {
          exportTime: new Date().toISOString(),
          totalDocuments: (
            await dbConnection.query(
              "SELECT COUNT(*) as count FROM kess_documents"
            )
          )[0].count,
          totalSummaries: (
            await dbConnection.query(
              "SELECT COUNT(*) as count FROM kess_summaries"
            )
          )[0].count,
        },
      };

      const fs = require("fs");
      const filename = `kess_export_${
        new Date().toISOString().split("T")[0]
      }.${format}`;

      if (format === "json") {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      } else if (format === "csv") {
        // 簡單的 CSV 匯出
        const csv = this.convertToCSV(data.summaries);
        fs.writeFileSync(filename, csv);
      }

      console.log(`✅ 資料已匯出到: ${filename}`);
    } catch (error) {
      console.error("❌ 匯出失敗:", error.message);
    }
  }

  /**
   * 顯示幫助資訊
   */
  showHelp() {
    console.log("🔧 KESS 管理工具");
    console.log("=".repeat(40));
    console.log("使用方式: node scripts/manage.js <命令> [參數]");
    console.log("\n可用命令:");
    console.log("  status          顯示系統狀態");
    console.log("  stats           顯示詳細統計");
    console.log("  cleanup [天數]  清理舊資料 (預設 90 天)");
    console.log("  reset           重置資料庫");
    console.log("  export [格式]   匯出資料 (json/csv)");
    console.log("  help            顯示此幫助資訊");
    console.log("\n範例:");
    console.log("  node scripts/manage.js status");
    console.log("  node scripts/manage.js cleanup 30");
    console.log("  node scripts/manage.js export csv");
  }

  /**
   * 格式化檔案大小
   */
  formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * 轉換為 CSV 格式
   */
  convertToCSV(data) {
    if (!data.length) return "";

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((value) =>
          typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
        )
        .join(",")
    );

    return [headers, ...rows].join("\n");
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  const command = process.argv[2] || "help";
  const args = process.argv.slice(3);

  const manager = new KessManager();
  manager.run(command, ...args);
}

module.exports = KessManager;
