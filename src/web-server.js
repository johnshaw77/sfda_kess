const express = require("express");
const path = require("path");
const moment = require("moment");
const config = require("../config");
const logger = require("./utils/logger");
const db = require("./database/connection");

class WebServer {
  constructor() {
    this.app = express();
    this.db = db;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // 設定 EJS 模板引擎
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(__dirname, "../views"));

    // 靜態檔案
    this.app.use(express.static(path.join(__dirname, "../public")));

    // 解析 JSON 和 URL-encoded 資料
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 設定全域變數
    this.app.locals = {
      moment: moment,
      siteName: "KESS - 知識提取與摘要系統",
      version: "1.0.0",
      // 輔助函數
      helpers: {
        // 根據檔案類型返回圖示
        getFileIcon: (extension) => {
          const icons = {
            pdf: "bi-file-earmark-pdf",
            doc: "bi-file-earmark-word",
            docx: "bi-file-earmark-word",
            xls: "bi-file-earmark-excel",
            xlsx: "bi-file-earmark-excel",
            ppt: "bi-file-earmark-ppt",
            pptx: "bi-file-earmark-ppt",
            txt: "bi-file-earmark-text",
            md: "bi-file-earmark-text",
            rtf: "bi-file-earmark-richtext",
          };
          return icons[extension?.toLowerCase()] || "bi-file-earmark";
        },

        // 格式化檔案大小
        formatFileSize: (bytes) => {
          if (bytes === 0) return "0 Bytes";
          const k = 1024;
          const sizes = ["Bytes", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
          );
        },

        // 格式化處理狀態
        getStatusText: (status) => {
          const statusMap = {
            pending: "待處理",
            processing: "處理中",
            completed: "已完成",
            failed: "處理失敗",
            archived: "已歸檔",
          };
          return statusMap[status] || status;
        },

        // 格式化處理狀態顏色
        getStatusColor: (status) => {
          const colorMap = {
            pending: "warning",
            processing: "info",
            completed: "success",
            failed: "danger",
            archived: "secondary",
          };
          return colorMap[status] || "secondary";
        },
      },
    };
  }

  setupRoutes() {
    // 首頁 - 重導向到儀表板
    this.app.get("/", (req, res) => {
      res.redirect("/dashboard");
    });

    // 儀表板
    this.app.get("/dashboard", async (req, res) => {
      try {
        const stats = await this.getDashboardStats();
        res.render("dashboard", {
          title: "儀表板",
          currentPage: "dashboard",
          stats: stats,
          recentDocuments: stats.recentDocuments,
          categoryStats: stats.categoryStats,
          moment: moment,
          helpers: this.app.locals.helpers,
        });
      } catch (error) {
        logger.error("儀表板載入失敗:", error);
        res.status(500).render("error", {
          title: "錯誤",
          message: "儀表板載入失敗",
          error: error.message,
        });
      }
    });

    // 文件列表
    this.app.get("/documents", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category || "";
        const status = req.query.status || "";
        const search = req.query.search || "";

        const documents = await this.getDocuments(
          page,
          limit,
          category,
          status,
          search
        );
        const categories = await this.getCategories();

        res.render("documents", {
          title: "文件管理",
          currentPage: "documents",
          documents: documents.data,
          pagination: documents.pagination,
          categories: categories,
          filters: { category, status, search },
          moment: moment,
          helpers: this.app.locals.helpers,
        });
      } catch (error) {
        logger.error("文件列表載入失敗:", error);
        res.status(500).render("error", {
          title: "錯誤",
          message: "文件列表載入失敗",
          error: error.message,
        });
      }
    });

    // 文件詳情
    this.app.get("/documents/:id", async (req, res) => {
      try {
        const document = await this.getDocumentById(req.params.id);
        if (!document) {
          return res.status(404).render("error", {
            title: "文件不存在",
            message: "找不到指定的文件",
            error: "文件可能已被刪除或移動",
          });
        }

        res.render("document-detail", {
          title: `文件詳情 - ${document.file_name}`,
          document: document,
        });
      } catch (error) {
        logger.error("文件詳情載入失敗:", error);
        res.status(500).render("error", {
          title: "錯誤",
          message: "文件詳情載入失敗",
          error: error.message,
        });
      }
    });

    // 摘要詳情
    this.app.get("/summaries/:id", async (req, res) => {
      try {
        const summary = await this.getSummaryById(req.params.id);
        if (!summary) {
          return res.status(404).render("error", {
            title: "摘要不存在",
            message: "找不到指定的摘要",
            error: "摘要可能已被刪除",
          });
        }

        res.render("summary", {
          title: `摘要詳情 - ${summary.file_name}`,
          summary: summary,
        });
      } catch (error) {
        logger.error("摘要詳情載入失敗:", error);
        res.status(500).render("error", {
          title: "錯誤",
          message: "摘要詳情載入失敗",
          error: error.message,
        });
      }
    });

    // API 路由
    this.setupApiRoutes();

    // 錯誤處理
    this.app.use((req, res) => {
      res.status(404).render("error", {
        title: "頁面不存在",
        message: "找不到您要訪問的頁面",
        error: "請檢查網址是否正確",
      });
    });
  }

  setupApiRoutes() {
    // 文件內容預覽 API
    this.app.get("/api/documents/:id/preview", async (req, res) => {
      try {
        const document = await this.getDocumentById(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "文件不存在" });
        }

        // 返回文件內容預覽
        res.json({
          id: document.id,
          file_name: document.file_name,
          content_preview: document.content_preview || "無預覽內容",
          file_size: document.file_size,
          processing_status: document.processing_status,
        });
      } catch (error) {
        logger.error("文件預覽 API 失敗:", error);
        res.status(500).json({ error: "預覽載入失敗" });
      }
    });

    // 文件下載 API
    this.app.get("/api/documents/:id/download", async (req, res) => {
      try {
        const document = await this.getDocumentById(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "文件不存在" });
        }

        const fs = require("fs");
        const path = require("path");

        // 檢查文件是否存在
        const filePath = path.resolve(document.file_path);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "文件檔案不存在" });
        }

        // 設定下載標頭
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(document.file_name)}"`
        );
        res.setHeader("Content-Type", "application/octet-stream");

        // 發送文件
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        logger.error("文件下載 API 失敗:", error);
        res.status(500).json({ error: "下載失敗" });
      }
    });

    // 重新處理文件 API
    this.app.post("/api/documents/:id/reprocess", async (req, res) => {
      try {
        const document = await this.getDocumentById(req.params.id);
        if (!document) {
          return res.status(404).json({ error: "文件不存在" });
        }

        // TODO: 實作重新處理邏輯
        logger.info(`重新處理文件: ${document.file_name}`);

        res.json({
          success: true,
          message: "文件已加入重新處理佇列",
          document_id: document.id,
        });
      } catch (error) {
        logger.error("重新處理 API 失敗:", error);
        res.status(500).json({ error: "重新處理失敗" });
      }
    });

    // 刪除文件 API
    this.app.delete("/api/documents/:id", async (req, res) => {
      try {
        const result = await this.deleteDocument(req.params.id);
        if (!result) {
          return res.status(404).json({ error: "文件不存在" });
        }

        res.json({
          success: true,
          message: "文件已刪除",
          document_id: req.params.id,
        });
      } catch (error) {
        logger.error("刪除文件 API 失敗:", error);
        res.status(500).json({ error: "刪除失敗" });
      }
    });
  }

  // 資料庫查詢方法
  async getDashboardStats() {
    try {
      const connection = await this.db.pool.getConnection();

      // 總文件數
      const [totalDocs] = await connection.execute(
        "SELECT COUNT(*) as count FROM kess_documents"
      );

      // 各狀態統計
      const [statusStats] = await connection.execute(`
        SELECT processing_status, COUNT(*) as count 
        FROM kess_documents 
        GROUP BY processing_status
      `);

      // 最近文件
      const [recentDocs] = await connection.execute(`
        SELECT d.*, c.category_name 
        FROM kess_documents d
        LEFT JOIN kess_categories c ON d.category_id = c.id
        ORDER BY d.created_at DESC 
        LIMIT 10
      `);

      // 類別統計
      const [categoryStats] = await connection.execute(`
        SELECT c.category_name, COUNT(d.id) as count
        FROM kess_categories c
        LEFT JOIN kess_documents d ON c.id = d.category_id
        WHERE c.is_active = 1
        GROUP BY c.id, c.category_name
        ORDER BY count DESC
      `);

      connection.release();

      return {
        totalDocuments: totalDocs[0].count,
        statusStats: statusStats,
        recentDocuments: recentDocs,
        categoryStats: categoryStats,
      };
    } catch (error) {
      logger.error("獲取儀表板統計失敗:", error);
      throw error;
    }
  }

  async getDocuments(
    page = 1,
    limit = 20,
    category = "",
    status = "",
    search = ""
  ) {
    try {
      const offset = (page - 1) * limit;
      const connection = await this.db.pool.getConnection();

      let whereClauses = [];
      let params = [];

      if (category) {
        whereClauses.push("d.category_id = ?");
        params.push(category);
      }

      if (status) {
        whereClauses.push("d.processing_status = ?");
        params.push(status);
      }

      if (search) {
        whereClauses.push("(d.file_name LIKE ? OR d.content_preview LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // 獲取總數
      const countSql = `
        SELECT COUNT(*) as total 
        FROM kess_documents d 
        LEFT JOIN kess_categories c ON d.category_id = c.id
        ${whereClause}
      `;
      const [countResult] = await connection.execute(countSql, params);

      // 獲取文件列表（使用字符串拼接而不是預處理語句來處理 LIMIT OFFSET）
      const listSql = `
        SELECT d.*, c.category_name,
               CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as has_summary
        FROM kess_documents d
        LEFT JOIN kess_categories c ON d.category_id = c.id
        LEFT JOIN kess_summaries s ON d.id = s.document_id
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [documents] = await connection.execute(listSql, params);

      connection.release();

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      return {
        data: documents,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit: limit,
        },
      };
    } catch (error) {
      logger.error("獲取文件列表失敗:", error);
      throw error;
    }
  }

  async getCategories() {
    try {
      const connection = await this.db.pool.getConnection();
      const [categories] = await connection.execute(`
        SELECT * FROM kess_categories 
        WHERE is_active = 1 
        ORDER BY sort_order, category_name
      `);
      connection.release();
      return categories;
    } catch (error) {
      logger.error("獲取類別列表失敗:", error);
      throw error;
    }
  }

  async getDocumentById(id) {
    try {
      const connection = await this.db.pool.getConnection();
      const [documents] = await connection.execute(
        `
        SELECT d.*, c.category_name
        FROM kess_documents d
        LEFT JOIN kess_categories c ON d.category_id = c.id
        WHERE d.id = ?
      `,
        [id]
      );
      connection.release();
      return documents[0] || null;
    } catch (error) {
      logger.error("獲取文件詳情失敗:", error);
      throw error;
    }
  }

  async getSummaryById(id) {
    try {
      const connection = await this.db.pool.getConnection();
      const [summaries] = await connection.execute(
        `
        SELECT s.*, d.file_name, d.file_path, c.category_name
        FROM kess_summaries s
        JOIN kess_documents d ON s.document_id = d.id
        LEFT JOIN kess_categories c ON d.category_id = c.id
        WHERE s.document_id = ?
      `,
        [id]
      );
      connection.release();
      return summaries[0] || null;
    } catch (error) {
      logger.error("獲取摘要詳情失敗:", error);
      throw error;
    }
  }

  async deleteDocument(id) {
    try {
      const connection = await this.db.pool.getConnection();
      await connection.beginTransaction();

      try {
        // 刪除相關摘要
        await connection.execute(
          "DELETE FROM kess_summaries WHERE document_id = ?",
          [id]
        );

        // 刪除文件記錄
        const [result] = await connection.execute(
          "DELETE FROM kess_documents WHERE id = ?",
          [id]
        );

        await connection.commit();
        connection.release();

        return result.affectedRows > 0;
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      logger.error("刪除文件失敗:", error);
      throw error;
    }
  }

  async start(port = 3000) {
    try {
      // 初始化資料庫連線
      await this.db.initialize();

      // 啟動伺服器
      this.app.listen(port, () => {
        logger.info(`KESS Web Server 已啟動: http://localhost:${port}`);
        console.log(`🚀 KESS Web Server 已啟動: http://localhost:${port}`);
      });
    } catch (error) {
      logger.error("Web 伺服器啟動失敗:", error);
      throw error;
    }
  }
}

module.exports = WebServer;
