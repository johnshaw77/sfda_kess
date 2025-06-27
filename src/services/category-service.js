const dbConnection = require("../database/connection");
const logger = require("../utils/logger");
const path = require("path");

class CategoryService {
  constructor() {}

  /**
   * 取得所有啟用的功能類別
   * @returns {Array} 功能類別清單
   */
  async getAllCategories() {
    try {
      const categories = await dbConnection.query(`
        SELECT * FROM kess_categories 
        WHERE is_active = TRUE 
        ORDER BY sort_order, category_name
      `);
      return categories;
    } catch (error) {
      logger.logError("取得功能類別清單失敗", error);
      throw error;
    }
  }

  /**
   * 根據代碼取得功能類別
   * @param {string} categoryCode - 功能代碼
   * @returns {Object|null} 功能類別資訊
   */
  async getCategoryByCode(categoryCode) {
    try {
      const result = await dbConnection.query(
        "SELECT * FROM kess_categories WHERE category_code = ? AND is_active = TRUE",
        [categoryCode]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.logError(`取得功能類別失敗: ${categoryCode}`, error);
      throw error;
    }
  }

  /**
   * 根據檔案路徑自動識別功能類別
   * @param {string} filePath - 檔案路徑
   * @returns {Object|null} 匹配的功能類別
   */
  async identifyCategoryByPath(filePath) {
    try {
      const categories = await this.getAllCategories();

      for (const category of categories) {
        // 檢查檔案路徑是否包含監控資料夾路徑
        if (category.watch_folder && filePath.includes(category.watch_folder)) {
          logger.logInfo(
            `路徑匹配分類: ${filePath} -> ${category.category_name} (${category.watch_folder})`
          );
          return category;
        }
      }

      // 如果沒有直接路徑匹配，使用其他方式識別
      for (const category of categories) {
        // 檢查檔案命名模式
        if (category.file_pattern) {
          const pattern = new RegExp(category.file_pattern, "i");
          if (pattern.test(path.basename(filePath))) {
            return category;
          }
        }

        // 根據路徑關鍵字判斷
        const pathKeywords = this.getCategoryKeywords(category.category_code);
        const lowerPath = filePath.toLowerCase();

        for (const keyword of pathKeywords) {
          if (lowerPath.includes(keyword)) {
            return category;
          }
        }
      }

      // 如果無法識別，返回預設類別（通用類別）
      const defaultCategory = await dbConnection.query(
        "SELECT * FROM kess_categories WHERE category_name = '通用類別' AND is_active = TRUE"
      );
      if (defaultCategory.length > 0) {
        return defaultCategory[0];
      }

      // 如果沒有通用類別，返回 ID 最小的類別
      const firstCategory = await dbConnection.query(
        "SELECT * FROM kess_categories WHERE is_active = TRUE ORDER BY id LIMIT 1"
      );
      return firstCategory.length > 0 ? firstCategory[0] : null;
    } catch (error) {
      logger.logError(`自動識別功能類別失敗: ${filePath}`, error);
      // 返回預設類別
      try {
        const defaultCategory = await dbConnection.query(
          "SELECT * FROM kess_categories WHERE category_name = '通用類別' AND is_active = TRUE"
        );
        return defaultCategory.length > 0 ? defaultCategory[0] : null;
      } catch (err) {
        return null;
      }
    }
  }

  /**
   * 根據檔案內容自動識別功能類別
   * @param {string} content - 檔案內容
   * @param {string} fileName - 檔案名稱
   * @returns {Object|null} 匹配的功能類別
   */
  async identifyCategoryByContent(content, fileName) {
    try {
      const lowerContent = content.toLowerCase();
      const lowerFileName = fileName.toLowerCase();

      // 製造相關關鍵字
      const mfgKeywords = [
        "生產",
        "製造",
        "產線",
        "設備",
        "工藝",
        "作業指導",
        "sop",
        "生產計劃",
        "產能",
        "良率",
      ];
      if (
        this.containsKeywords(lowerContent, mfgKeywords) ||
        this.containsKeywords(lowerFileName, mfgKeywords)
      ) {
        return await this.getCategoryByCode("MFG");
      }

      // 品保相關關鍵字
      const qaKeywords = [
        "品質",
        "檢驗",
        "測試",
        "不良",
        "缺陷",
        "品保",
        "qc",
        "qa",
        "audit",
        "iso",
      ];
      if (
        this.containsKeywords(lowerContent, qaKeywords) ||
        this.containsKeywords(lowerFileName, qaKeywords)
      ) {
        return await this.getCategoryByCode("QA");
      }

      // 資訊相關關鍵字
      const itKeywords = [
        "系統",
        "軟體",
        "程式",
        "database",
        "server",
        "api",
        "技術",
        "開發",
        "維護",
      ];
      if (
        this.containsKeywords(lowerContent, itKeywords) ||
        this.containsKeywords(lowerFileName, itKeywords)
      ) {
        return await this.getCategoryByCode("IT");
      }

      // 人資相關關鍵字
      const hrKeywords = [
        "人事",
        "招聘",
        "培訓",
        "薪資",
        "績效",
        "考勤",
        "員工",
        "人力資源",
      ];
      if (
        this.containsKeywords(lowerContent, hrKeywords) ||
        this.containsKeywords(lowerFileName, hrKeywords)
      ) {
        return await this.getCategoryByCode("HR");
      }

      // 財務相關關鍵字
      const finKeywords = [
        "財務",
        "會計",
        "預算",
        "成本",
        "費用",
        "報表",
        "發票",
        "採購",
        "應收",
        "應付",
      ];
      if (
        this.containsKeywords(lowerContent, finKeywords) ||
        this.containsKeywords(lowerFileName, finKeywords)
      ) {
        return await this.getCategoryByCode("FIN");
      }

      // 研發相關關鍵字
      const rndKeywords = [
        "研發",
        "設計",
        "專利",
        "技術",
        "創新",
        "產品開發",
        "實驗",
        "測試",
      ];
      if (
        this.containsKeywords(lowerContent, rndKeywords) ||
        this.containsKeywords(lowerFileName, rndKeywords)
      ) {
        return await this.getCategoryByCode("R&D");
      }

      // 行政相關關鍵字
      const adminKeywords = [
        "行政",
        "公告",
        "政策",
        "會議",
        "流程",
        "管理",
        "辦公",
      ];
      if (
        this.containsKeywords(lowerContent, adminKeywords) ||
        this.containsKeywords(lowerFileName, adminKeywords)
      ) {
        return await this.getCategoryByCode("ADMIN");
      }

      // 預設返回 IT 類別
      return await this.getCategoryByCode("IT");
    } catch (error) {
      logger.logError("根據內容識別功能類別失敗", error);
      return await this.getCategoryByCode("IT");
    }
  }

  /**
   * 檢查文字是否包含關鍵字
   * @param {string} text - 要檢查的文字
   * @param {Array} keywords - 關鍵字陣列
   * @returns {boolean} 是否包含關鍵字
   */
  containsKeywords(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * 取得功能類別的關鍵字
   * @param {string} categoryCode - 功能代碼
   * @returns {Array} 關鍵字陣列
   */
  getCategoryKeywords(categoryCode) {
    const keywordMap = {
      MFG: ["manufacturing", "production", "factory", "製造", "生產"],
      QA: ["quality", "qa", "qc", "test", "品保", "品質"],
      IT: ["it", "tech", "system", "software", "資訊", "技術"],
      HR: ["hr", "human", "personnel", "人資", "人事"],
      FIN: ["finance", "accounting", "budget", "財務", "會計"],
      "R&D": ["rnd", "research", "development", "研發", "開發"],
      ADMIN: ["admin", "office", "management", "行政", "管理"],
    };

    return keywordMap[categoryCode] || [];
  }

  /**
   * 建立新的功能類別
   * @param {Object} categoryData - 功能類別資料
   * @returns {number} 新建立的類別 ID
   */
  async createCategory(categoryData) {
    try {
      const result = await dbConnection.query(
        `
        INSERT INTO kess_categories (
          category_code, category_name, description, 
          watch_folder, archive_folder, file_pattern, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          categoryData.category_code,
          categoryData.category_name,
          categoryData.description || "",
          categoryData.watch_folder || "",
          categoryData.archive_folder || "",
          categoryData.file_pattern || "",
          categoryData.sort_order || 0,
        ]
      );

      logger.logProcessing(
        "CATEGORY_CREATE",
        `建立功能類別: ${categoryData.category_name}`
      );
      return result.insertId;
    } catch (error) {
      logger.logError("建立功能類別失敗", error);
      throw error;
    }
  }

  /**
   * 更新功能類別
   * @param {number} categoryId - 類別 ID
   * @param {Object} updateData - 更新資料
   */
  async updateCategory(categoryId, updateData) {
    try {
      const result = await dbConnection.query(
        `
        UPDATE kess_categories SET 
          category_name = COALESCE(?, category_name),
          description = COALESCE(?, description),
          watch_folder = COALESCE(?, watch_folder),
          archive_folder = COALESCE(?, archive_folder),
          file_pattern = COALESCE(?, file_pattern),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = NOW()
        WHERE id = ?
      `,
        [
          updateData.category_name,
          updateData.description,
          updateData.watch_folder,
          updateData.archive_folder,
          updateData.file_pattern,
          updateData.sort_order,
          updateData.is_active,
          categoryId,
        ]
      );

      if (result.affectedRows === 0) {
        throw new Error(`功能類別不存在: ${categoryId}`);
      }

      logger.logProcessing("CATEGORY_UPDATE", `更新功能類別: ${categoryId}`);
    } catch (error) {
      logger.logError(`更新功能類別失敗: ${categoryId}`, error);
      throw error;
    }
  }

  /**
   * 取得功能類別統計
   * @returns {Array} 統計資料
   */
  async getCategoryStatistics() {
    try {
      const stats = await dbConnection.query(`
        SELECT 
          c.id,
          c.category_code,
          c.category_name,
          c.watch_folder,
          c.archive_folder,
          COUNT(d.id) as total_documents,
          COUNT(CASE WHEN d.processing_status = 'completed' THEN 1 END) as completed_documents,
          COUNT(CASE WHEN d.processing_status = 'pending' THEN 1 END) as pending_documents,
          COUNT(CASE WHEN d.is_archived = TRUE THEN 1 END) as archived_documents,
          SUM(d.file_size) as total_file_size,
          MAX(d.created_at) as last_document_time
        FROM kess_categories c
        LEFT JOIN kess_documents d ON c.id = d.category_id
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.category_code, c.category_name
        ORDER BY c.sort_order
      `);

      return stats;
    } catch (error) {
      logger.logError("取得功能類別統計失敗", error);
      throw error;
    }
  }

  /**
   * 獲取所有有效的監控資料夾
   * @returns {Array<string>} 監控資料夾路徑陣列
   */
  async getWatchFolders() {
    try {
      const result = await dbConnection.query(`
        SELECT DISTINCT watch_folder 
        FROM kess_categories 
        WHERE is_active = TRUE 
          AND watch_folder IS NOT NULL 
          AND watch_folder != ''
        ORDER BY watch_folder
      `);

      const watchFolders = result.map((row) => row.watch_folder);
      logger.info(`從資料庫載入監控資料夾: ${watchFolders.join(", ")}`);

      return watchFolders;
    } catch (error) {
      logger.logError("獲取監控資料夾失敗", error);
      throw error;
    }
  }

  /**
   * 智能分類建議
   * @param {string} filePath - 檔案路徑
   * @param {string} content - 檔案內容
   * @param {string} fileName - 檔案名稱
   * @returns {Object} 分類建議
   */
  async suggestCategory(filePath, content, fileName) {
    try {
      // 1. 先根據路徑判斷
      const pathCategory = await this.identifyCategoryByPath(filePath);

      // 2. 根據內容判斷
      const contentCategory = await this.identifyCategoryByContent(
        content,
        fileName
      );

      // 3. 計算信心度
      let confidence = 0.5; // 基礎信心度
      let suggestedCategory = contentCategory;

      // 如果路徑和內容判斷一致，提高信心度
      if (
        pathCategory &&
        contentCategory &&
        pathCategory.id === contentCategory.id
      ) {
        confidence = 0.9;
        suggestedCategory = pathCategory;
      } else if (pathCategory) {
        // 路徑判斷通常比較準確
        confidence = 0.7;
        suggestedCategory = pathCategory;
      }

      return {
        suggestedCategory: suggestedCategory,
        confidence: confidence,
        pathCategory: pathCategory,
        contentCategory: contentCategory,
        reason: this.generateClassificationReason(
          pathCategory,
          contentCategory
        ),
      };
    } catch (error) {
      logger.logError("智能分類建議失敗", error);

      // 返回預設建議
      const defaultCategory = await this.getCategoryByCode("IT");
      return {
        suggestedCategory: defaultCategory,
        confidence: 0.3,
        pathCategory: null,
        contentCategory: null,
        reason: "自動判斷失敗，使用預設類別",
      };
    }
  }

  /**
   * 生成分類原因說明
   * @param {Object} pathCategory - 路徑判斷結果
   * @param {Object} contentCategory - 內容判斷結果
   * @returns {string} 分類原因
   */
  generateClassificationReason(pathCategory, contentCategory) {
    if (
      pathCategory &&
      contentCategory &&
      pathCategory.id === contentCategory.id
    ) {
      return `路徑和內容分析一致，判斷為 ${pathCategory.category_name}`;
    } else if (pathCategory && contentCategory) {
      return `路徑分析: ${pathCategory.category_name}，內容分析: ${contentCategory.category_name}，採用路徑判斷`;
    } else if (pathCategory) {
      return `根據檔案路徑判斷為 ${pathCategory.category_name}`;
    } else if (contentCategory) {
      return `根據檔案內容判斷為 ${contentCategory.category_name}`;
    } else {
      return "無法自動判斷，使用預設類別";
    }
  }

  /**
   * 根據路徑對應規則取得分類 ID
   * @param {string} filePath - 檔案路徑
   * @returns {number|null} 分類 ID，如果沒有匹配則返回 null
   */
  async getCategoryByPathMapping(filePath) {
    try {
      const mappings = await dbConnection.query(`
        SELECT path_pattern, category_id, is_regex, priority
        FROM kess_path_category_mapping
        WHERE is_active = TRUE
        ORDER BY priority DESC
      `);

      for (const mapping of mappings) {
        if (this.matchPath(filePath, mapping.path_pattern, mapping.is_regex)) {
          logger.logInfo(
            `路徑對應匹配: ${filePath} -> 分類 ${mapping.category_id}`
          );
          return mapping.category_id;
        }
      }

      return null; // 沒有找到匹配的路徑對應
    } catch (error) {
      logger.logError(`取得路徑對應分類失敗: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 路徑匹配函數
   * @param {string} filePath - 檔案路徑
   * @param {string} pattern - 路徑模式
   * @param {boolean} isRegex - 是否為正規表達式
   * @returns {boolean} 是否匹配
   */
  matchPath(filePath, pattern, isRegex = false) {
    if (isRegex) {
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(filePath);
      } catch (error) {
        logger.logError(`正規表達式錯誤: ${pattern}`, error);
        return false;
      }
    } else {
      // 支援 SQL LIKE 語法的通配符匹配
      const regexPattern = pattern
        .replace(/\\/g, "\\\\") // 轉義反斜線
        .replace(/%/g, ".*") // % 匹配任何字符序列
        .replace(/_/g, "."); // _ 匹配任何單個字符

      try {
        const regex = new RegExp(`^${regexPattern}$`, "i");
        return regex.test(filePath);
      } catch (error) {
        logger.logError(`通配符模式錯誤: ${pattern}`, error);
        return false;
      }
    }
  }
}

module.exports = CategoryService;
