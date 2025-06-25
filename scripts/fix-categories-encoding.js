const dbConnection = require("../src/database/connection");
const logger = require("../src/utils/logger");

/**
 * 修正 kess_categories 表格中文亂碼問題
 * 這個腳本專門處理在初始化過程中可能產生的中文編碼問題
 */

async function fixKessCategoriesEncoding() {
  try {
    console.log("=== 修正 kess_categories 中文編碼問題 ===\n");

    // 初始化資料庫連線
    if (!dbConnection.isReady()) {
      await dbConnection.initialize();
    }

    // 1. 檢查當前表格字元集
    console.log("1. 檢查當前表格字元集...");
    const charsetResult = await dbConnection.query(`
      SELECT 
        table_name,
        table_collation,
        ccsa.character_set_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.collation_character_set_applicability ccsa 
        ON t.table_collation = ccsa.collation_name
      WHERE table_schema = DATABASE() 
        AND table_name = 'kess_categories'
    `);
    
    if (charsetResult.length > 0) {
      console.log("當前表格字元集資訊:", charsetResult[0]);
    }

    // 2. 檢查當前資料狀況
    console.log("\n2. 檢查當前資料狀況...");
    const currentData = await dbConnection.query(
      "SELECT id, category_code, category_name, description FROM kess_categories ORDER BY sort_order"
    );

    console.log("當前資料：");
    currentData.forEach(row => {
      console.log(`  ${row.category_code}: ${row.category_name}`);
    });

    // 3. 檢查是否有亂碼
    let hasGarbledText = false;
    for (const row of currentData) {
      if (row.category_name.includes('�') || 
          row.category_name.includes('?') || 
          /[^\u0000-\u007F\u4e00-\u9fff\u3400-\u4dbf]/.test(row.category_name)) {
        hasGarbledText = true;
        console.log(`❌ 發現亂碼資料: ${row.category_code} - ${row.category_name}`);
      }
    }

    if (!hasGarbledText) {
      console.log("✅ 未發現明顯的中文亂碼問題");
      return;
    }

    // 4. 確保表格使用正確的字元集
    console.log("\n3. 確保表格字元集正確...");
    await dbConnection.query(
      "ALTER TABLE kess_categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    console.log("✅ 表格字元集已設定為 utf8mb4");    // 5. 備份原始資料（移除刪除和重建部分）
    console.log("\n4. 備份原始資料...");
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS kess_categories_backup_${Date.now()} AS 
      SELECT * FROM kess_categories
    `);
    console.log("✅ 原始資料已備份");// 6. 修正亂碼資料 - 使用 UPDATE 而不是刪除重插
    console.log("\n5. 修正亂碼資料...");
    
    // 準備正確的中文資料對應表
    const correctMappings = {
      'GENERAL': { name: '通用文件', desc: '一般文件，未特別分類的文件' },
      'MFG': { name: '製造部門', desc: '製造相關文件，包含生產計劃、工藝文件、設備維護等' },
      'QA': { name: '品保部門', desc: '品質保證相關文件，包含檢驗報告、品質標準、不良分析等' },
      'IT': { name: '資訊部門', desc: '資訊技術相關文件，包含系統文檔、技術規範、維護記錄等' },
      'HR': { name: '人資部門', desc: '人力資源相關文件，包含招聘、培訓、績效評估等' },
      'FIN': { name: '財務部門', desc: '財務相關文件，包含報表、預算、採購、會計等' },
      'R&D': { name: '研發部門', desc: '研發相關文件，包含產品設計、技術研究、專利等' },
      'ADMIN': { name: '行政部門', desc: '行政管理相關文件，包含公告、政策、會議記錄等' }
    };

    // 逐筆更新有問題的資料
    for (const row of currentData) {
      const correctInfo = correctMappings[row.category_code];
      if (correctInfo) {
        // 檢查是否需要更新
        const needsUpdate = row.category_name !== correctInfo.name || 
                           (row.description && row.description !== correctInfo.desc);
        
        if (needsUpdate) {
          await dbConnection.query(`
            UPDATE kess_categories 
            SET category_name = ?, description = ?, updated_at = NOW()
            WHERE id = ?
          `, [correctInfo.name, correctInfo.desc, row.id]);
          
          console.log(`✅ 更新: ${row.category_code} - ${correctInfo.name}`);
        } else {
          console.log(`✓ 無需更新: ${row.category_code} - ${row.category_name}`);
        }
      }
    }

    // 如果沒有 GENERAL 類別，新增它
    const hasGeneral = currentData.some(row => row.category_code === 'GENERAL');
    if (!hasGeneral) {
      await dbConnection.query(`
        INSERT INTO kess_categories 
        (category_code, category_name, description, watch_folder, archive_folder, sort_order) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'GENERAL',
        '通用文件',
        '一般文件，未特別分類的文件',
        './watch/general',
        './archive/general',
        0
      ]);
      console.log(`✅ 新增: GENERAL - 通用文件`);
    }    // 7. 驗證修正結果
    console.log("\n6. 驗證修正結果...");
    const verifyData = await dbConnection.query(
      "SELECT id, category_code, category_name, description FROM kess_categories ORDER BY sort_order"
    );

    console.log("修正後的資料：");
    verifyData.forEach(row => {
      console.log(`  ${row.category_code}: ${row.category_name}`);
    });

    // 8. 檢查是否還有問題
    let stillHasIssues = false;
    for (const row of verifyData) {
      if (row.category_name.includes('�') || 
          row.category_name.includes('?') || 
          !/[\u4e00-\u9fff]/.test(row.category_name)) {
        stillHasIssues = true;
        console.log(`❌ 仍有問題: ${row.category_code} - ${row.category_name}`);
      }
    }

    if (!stillHasIssues) {
      console.log("\n🎉 kess_categories 中文編碼問題修正完成！");
      console.log("所有中文內容現在都能正確顯示。");
    } else {
      console.log("\n⚠️ 仍有部分中文顯示問題，請檢查資料庫設定。");
    }

  } catch (error) {
    console.error("修正過程發生錯誤:", error);
    throw error;
  }
}

// 執行修正
if (require.main === module) {
  fixKessCategoriesEncoding()
    .then(() => {
      console.log("\n=== 修正完成 ===");
      process.exit(0);
    })
    .catch((error) => {
      console.error("修正失敗:", error);
      process.exit(1);
    });
}

module.exports = { fixKessCategoriesEncoding };
