const mysql = require("mysql2/promise");
const config = require("../../config");
const logger = require("../utils/logger");

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * 初始化資料庫連線池
   */
  async initialize() {
    try {
      // 使用連線字串的方式，確保字元集正確
      const connectionString = `mysql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}?charset=utf8mb4&connectionLimit=10`;

      this.pool = mysql.createPool(connectionString);

      // 測試連線
      await this.testConnection();
      this.isConnected = true;
      logger.info("資料庫連線初始化成功");
    } catch (error) {
      logger.error("資料庫連線初始化失敗:", error);
      throw error;
    }
  }

  /**
   * 測試資料庫連線
   */
  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();

      // 設定字元集為 utf8mb4
      await connection.execute("SET NAMES utf8mb4");
      await connection.execute("SET CHARACTER SET utf8mb4");
      await connection.execute("SET character_set_connection=utf8mb4");
      await connection.execute("SET character_set_results=utf8mb4");
      await connection.execute("SET character_set_client=utf8mb4");

      connection.release();
      logger.info("資料庫連線測試成功");
    } catch (error) {
      logger.error("資料庫連線測試失敗:", error);
      throw error;
    }
  }

  /**
   * 執行 SQL 查詢
   * @param {string} sql - SQL 語句
   * @param {Array} params - 參數陣列
   * @returns {Promise<Array>} 查詢結果
   */
  async query(sql, params = []) {
    let connection;
    try {
      connection = await this.pool.getConnection();

      // 確保使用正確的字元集
      await connection.execute("SET NAMES utf8mb4");

      const [rows] = await connection.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error("SQL 查詢執行失敗:", { sql, params, error: error.message });
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * 開始事務
   * @returns {Promise<Connection>} 資料庫連線
   */
  async beginTransaction() {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  /**
   * 提交事務
   * @param {Connection} connection - 資料庫連線
   */
  async commitTransaction(connection) {
    await connection.commit();
    connection.release();
  }

  /**
   * 回滾事務
   * @param {Connection} connection - 資料庫連線
   */
  async rollbackTransaction(connection) {
    await connection.rollback();
    connection.release();
  }

  /**
   * 關閉連線池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info("資料庫連線已關閉");
    }
  }

  /**
   * 取得連線池
   */
  getPool() {
    return this.pool;
  }

  /**
   * 檢查連線狀態
   */
  isReady() {
    return this.isConnected && this.pool;
  }
}

// 建立單例
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;
