const axios = require("axios");
const config = require("../../config");
const logger = require("../utils/logger");
const dbConnection = require("../database/connection");
const PromptManager = require("./prompt-manager");

class SummaryService {
  constructor() {
    this.llmClient = null;
    this.promptManager = new PromptManager();
    this.isInitialized = false;
  }

  /**
   * 初始化摘要服務
   */
  async initialize() {
    try {
      logger.logProcessing("SUMMARY_INIT", "初始化摘要服務...");

      // 根據設定選擇 LLM 提供者
      switch (config.llm.provider) {
        case "openai":
          this.llmClient = new OpenAIClient();
          break;
        case "local":
          this.llmClient = new LocalLLMClient();
          break;
        default:
          throw new Error(`不支援的 LLM 提供者: ${config.llm.provider}`);
      }

      await this.llmClient.initialize();
      this.isInitialized = true;

      logger.logProcessing("SUMMARY_INIT", "摘要服務初始化完成");
    } catch (error) {
      logger.logError("摘要服務初始化失敗", error);
      throw error;
    }
  }

  /**
   * 生成文件摘要
   * @param {number} documentId - 文件 ID
   * @param {Object} documentData - 文件資料
   */
  async generateSummary(documentId, documentData) {
    const startTime = Date.now();

    try {
      logger.logProcessing(
        "SUMMARY_START",
        `開始生成摘要: ${documentData.fileName}`
      );

      // 1. 準備提示詞
      logger.info(`[PROMPT_BUILD] 開始建立提示詞 for ${documentData.fileName}`);
      const prompt = this.buildPrompt(documentData);
      logger.info(`[PROMPT_BUILD] 提示詞建立完成，長度: ${prompt.length} 字元`);

      // 2. 呼叫 LLM 生成摘要
      logger.info(`[LLM_CALL] 呼叫 LLM 服務 (${config.llm.provider})`);
      const summaryResult = await this.llmClient.generateSummary(
        prompt,
        documentData
      );
      logger.info(`[LLM_CALL] LLM 服務回應完成`);

      // 3. 處理摘要結果
      logger.info(`[SUMMARY_PROCESS] 開始處理摘要結果`);
      const processedSummary = this.processSummaryResult(summaryResult);
      logger.info(`[SUMMARY_PROCESS] 摘要處理完成`);
      logger.info(
        `[SUMMARY_PROCESS] 摘要長度: ${processedSummary.summary.length} 字元`
      );
      logger.info(
        `[SUMMARY_PROCESS] 關鍵點數量: ${processedSummary.keyPoints.length}`
      );
      logger.info(
        `[SUMMARY_PROCESS] 關鍵字數量: ${processedSummary.keywords.length}`
      );
      logger.info(
        `[SUMMARY_PROCESS] 文件類型: ${processedSummary.documentType}`
      );
      logger.info(
        `[SUMMARY_PROCESS] 信心分數: ${processedSummary.confidenceScore}`
      );

      // 4. 儲存摘要到資料庫
      logger.info(`[DB_SAVE] 開始儲存摘要到資料庫`);
      await this.saveSummary(documentId, processedSummary, summaryResult);
      logger.info(`[DB_SAVE] 摘要儲存完成`);

      const processingTime = Date.now() - startTime;
      logger.logPerformance("SUMMARY_COMPLETE", processingTime, {
        documentId: documentId,
        fileName: documentData.fileName,
        summaryLength: processedSummary.summary.length,
      });

      logger.info(
        `[SUMMARY_COMPLETE] 完整摘要生成流程結束，總耗時: ${processingTime}ms`
      );
    } catch (error) {
      logger.logError(`生成摘要失敗: ${documentData.fileName}`, error);

      // 記錄錯誤到處理日誌
      await this.logProcessingError(documentId, "SUMMARY_GENERATION", error);
      throw error;
    }
  }

  /**
   * 建立提示詞
   * @param {Object} documentData - 文件資料
   * @returns {string} 提示詞
   */
  buildPrompt(documentData) {
    return this.promptManager.getOptimalPrompt(documentData);
  }

  /**
   * 處理摘要結果
   * @param {Object} summaryResult - LLM 回應結果
   * @returns {Object} 處理後的摘要資料
   */
  processSummaryResult(summaryResult) {
    try {
      logger.info(`[PARSE_START] 開始解析 LLM 回應結果`);
      const content = summaryResult.content || summaryResult.text || "";
      logger.info(`[PARSE_START] 原始回應長度: ${content.length} 字元`);

      // 使用正規表達式解析結構化回應
      logger.info(`[PARSE_SECTIONS] 開始解析各個章節`);
      const summary = this.extractSection(content, "文件摘要");
      logger.info(
        `[PARSE_SECTIONS] 摘要章節: ${summary ? summary.length : 0} 字元`
      );

      const keyPoints = this.extractKeyPoints(content);
      logger.info(`[PARSE_SECTIONS] 關鍵點: ${keyPoints.length} 個`);

      const keywords = this.extractKeywords(content);
      logger.info(`[PARSE_SECTIONS] 關鍵字: ${keywords.length} 個`);

      const entities = this.extractEntities(content);
      logger.info(
        `[PARSE_SECTIONS] 實體: ${Object.keys(entities).length} 類型`
      );

      const documentType = this.extractSection(content, "文件類型分類");
      logger.info(`[PARSE_SECTIONS] 文件類型: ${documentType || "未分類"}`);

      const confidenceScore = this.extractConfidenceScore(content);
      logger.info(`[PARSE_SECTIONS] 信心分數: ${confidenceScore}`);

      const result = {
        summary: summary || content.substring(0, config.summary.maxLength),
        keyPoints: keyPoints,
        keywords: keywords,
        entities: entities,
        documentType: documentType,
        confidenceScore: confidenceScore,
      };

      logger.info(
        `[PARSE_COMPLETE] 解析完成，最終摘要長度: ${result.summary.length} 字元`
      );
      return result;
    } catch (error) {
      logger.logError("處理摘要結果失敗", error);
      logger.warn(`[PARSE_FALLBACK] 使用後備解析方案`);

      // 如果解析失敗，返回基本摘要
      const fallbackResult = {
        summary: summaryResult.content || summaryResult.text || "",
        keyPoints: [],
        keywords: [],
        entities: {},
        documentType: "未分類",
        confidenceScore: 0.5,
      };

      logger.info(
        `[PARSE_FALLBACK] 後備解析完成，摘要長度: ${fallbackResult.summary.length} 字元`
      );
      return fallbackResult;
    }
  }

  /**
   * 提取特定章節內容
   * @param {string} content - 完整內容
   * @param {string} sectionName - 章節名稱
   * @returns {string} 章節內容
   */
  extractSection(content, sectionName) {
    const regex = new RegExp(
      `${sectionName}[：:]([\\s\\S]*?)(?=\\n\\d+\\.|$)`,
      "i"
    );
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  }

  /**
   * 提取關鍵要點
   * @param {string} content - 完整內容
   * @returns {Array<string>} 關鍵要點陣列
   */
  extractKeyPoints(content) {
    const keyPointsSection = this.extractSection(content, "關鍵要點");
    if (!keyPointsSection) return [];

    const points = keyPointsSection
      .split(/[-•]\s*/)
      .map((point) => point.trim())
      .filter((point) => point.length > 0);

    return points;
  }

  /**
   * 提取關鍵字
   * @param {string} content - 完整內容
   * @returns {Array<string>} 關鍵字陣列
   */
  extractKeywords(content) {
    const keywordsSection = this.extractSection(content, "關鍵字");
    if (!keywordsSection) return [];

    const keywords = keywordsSection
      .split(/[,，、]/)
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    return keywords;
  }

  /**
   * 提取實體資訊
   * @param {string} content - 完整內容
   * @returns {Object} 實體資訊物件
   */
  extractEntities(content) {
    const entitiesSection = this.extractSection(content, "實體識別");
    const entities = {
      persons: [],
      organizations: [],
      locations: [],
      dates: [],
    };

    if (!entitiesSection) return entities;

    const lines = entitiesSection.split("\n");
    for (const line of lines) {
      if (line.includes("人物:")) {
        entities.persons = this.parseEntityList(line, "人物:");
      } else if (line.includes("組織:")) {
        entities.organizations = this.parseEntityList(line, "組織:");
      } else if (line.includes("地點:")) {
        entities.locations = this.parseEntityList(line, "地點:");
      } else if (line.includes("時間:")) {
        entities.dates = this.parseEntityList(line, "時間:");
      }
    }

    return entities;
  }

  /**
   * 解析實體清單
   * @param {string} line - 包含實體的行
   * @param {string} prefix - 前綴
   * @returns {Array<string>} 實體清單
   */
  parseEntityList(line, prefix) {
    const content = line.replace(prefix, "").trim();
    if (!content || content === "[無]" || content.includes("無")) {
      return [];
    }

    return content
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  /**
   * 提取可信度分數
   * @param {string} content - 完整內容
   * @returns {number} 可信度分數 (0-1)
   */
  extractConfidenceScore(content) {
    const confidenceSection = this.extractSection(content, "可信度評估");
    if (!confidenceSection) return 0.5;

    const scoreMatch = confidenceSection.match(/(\d+(?:\.\d+)?)/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      // 將 1-10 分轉換為 0-1 分
      return Math.min(Math.max(score / 10, 0), 1);
    }

    return 0.5;
  }

  /**
   * 儲存摘要到資料庫
   * @param {number} documentId - 文件 ID
   * @param {Object} summaryData - 摘要資料
   * @param {Object} llmResult - LLM 原始結果
   */
  async saveSummary(documentId, summaryData, llmResult) {
    try {
      // 檢查是否已存在摘要
      const existing = await dbConnection.query(
        "SELECT id FROM kess_summaries WHERE document_id = ?",
        [documentId]
      );

      const summaryRecord = {
        document_id: documentId,
        summary_text: summaryData.summary,
        key_points: JSON.stringify(summaryData.keyPoints),
        keywords: JSON.stringify(summaryData.keywords),
        entities: JSON.stringify(summaryData.entities),
        llm_provider: config.llm.provider,
        llm_model: this.llmClient.getModelName(),
        processing_time_ms: llmResult.processingTime || 0,
        token_usage: JSON.stringify(llmResult.tokenUsage || {}),
        confidence_score: summaryData.confidenceScore,
      };

      if (existing.length > 0) {
        // 更新現有摘要
        await dbConnection.query(
          `
          UPDATE kess_summaries SET 
            summary_text = ?, key_points = ?, keywords = ?, entities = ?,
            llm_provider = ?, llm_model = ?, processing_time_ms = ?,
            token_usage = ?, confidence_score = ?, updated_at = NOW()
          WHERE document_id = ?
        `,
          [
            summaryRecord.summary_text,
            summaryRecord.key_points,
            summaryRecord.keywords,
            summaryRecord.entities,
            summaryRecord.llm_provider,
            summaryRecord.llm_model,
            summaryRecord.processing_time_ms,
            summaryRecord.token_usage,
            summaryRecord.confidence_score,
            documentId,
          ]
        );

        logger.logProcessing("SUMMARY_UPDATE", `更新摘要記錄: ${documentId}`);
      } else {
        // 新增摘要記錄
        await dbConnection.query(
          `
          INSERT INTO kess_summaries (
            document_id, summary_text, key_points, keywords, entities,
            llm_provider, llm_model, processing_time_ms, token_usage, confidence_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            summaryRecord.document_id,
            summaryRecord.summary_text,
            summaryRecord.key_points,
            summaryRecord.keywords,
            summaryRecord.entities,
            summaryRecord.llm_provider,
            summaryRecord.llm_model,
            summaryRecord.processing_time_ms,
            summaryRecord.token_usage,
            summaryRecord.confidence_score,
          ]
        );

        logger.logProcessing("SUMMARY_INSERT", `新增摘要記錄: ${documentId}`);
      }
    } catch (error) {
      logger.logError("儲存摘要失敗", error);
      throw error;
    }
  }

  /**
   * 記錄處理錯誤
   * @param {number} documentId - 文件 ID
   * @param {string} stage - 處理階段
   * @param {Error} error - 錯誤物件
   */
  async logProcessingError(documentId, stage, error) {
    try {
      await dbConnection.query(
        `
        INSERT INTO kess_processing_logs (
          document_id, log_level, log_message, log_details, 
          error_stack, processing_stage
        ) VALUES (?, 'error', ?, ?, ?, ?)
      `,
        [
          documentId,
          error.message,
          JSON.stringify({
            errorName: error.name,
            timestamp: new Date().toISOString(),
          }),
          error.stack,
          stage,
        ]
      );
    } catch (logError) {
      logger.logError("記錄處理錯誤失敗", logError);
    }
  }
}

/**
 * OpenAI 客戶端
 */
class OpenAIClient {
  constructor() {
    this.apiKey = config.llm.openai.apiKey;
    this.model = config.llm.openai.model;
    this.baseURL = config.llm.openai.baseURL;
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error("OpenAI API Key 未設定");
    }
    logger.logProcessing("LLM_INIT", `OpenAI 客戶端初始化完成 (${this.model})`);
  }

  async generateSummary(prompt, documentData) {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "你是一個專業的文件分析助手，擅長提取文件的關鍵資訊並生成結構化摘要。請按照用戶要求的格式提供詳細分析。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: config.llm.openai.maxTokens,
          temperature: config.llm.openai.temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      const processingTime = Date.now() - startTime;
      const result = response.data.choices[0].message;

      return {
        content: result.content,
        processingTime: processingTime,
        tokenUsage: response.data.usage || {},
      };
    } catch (error) {
      logger.logError("OpenAI API 呼叫失敗", error);
      throw new Error(`OpenAI API 錯誤: ${error.message}`);
    }
  }

  getModelName() {
    return this.model;
  }
}

/**
 * 本地 LLM 客戶端（例如 Ollama）
 */
class LocalLLMClient {
  constructor() {
    this.baseURL = config.llm.local.url;
    this.model = config.llm.local.model;
  }

  async initialize() {
    try {
      console.log(`${this.baseURL}/api/tags`);
      // 測試連線
      await axios.get(`${this.baseURL}/api/tags`);
      logger.logProcessing(
        "LLM_INIT",
        `本地 LLM 客戶端初始化完成 (${this.model})`
      );
    } catch (error) {
      throw new Error(`無法連接到本地 LLM 服務: ${error.message}`);
    }
  }

  async generateSummary(prompt, documentData) {
    const startTime = Date.now();

    try {
      logger.info(`[LLM_REQUEST] 開始呼叫 LLM 模型: ${this.model}`);
      logger.info(`[LLM_REQUEST] 檔案: ${documentData.fileName}`);
      logger.info(`[LLM_REQUEST] 文件內容長度: ${prompt.length} 字元`);

      // 為 Gemma 3 優化的提示詞格式
      const optimizedPrompt = `<bos><start_of_turn>user
${prompt}
<end_of_turn>
<start_of_turn>model
`;

      logger.info(`[LLM_REQUEST] 發送請求到: ${this.baseURL}/api/generate`);
      logger.info(
        `[LLM_REQUEST] 請求參數: temperature=0.7, top_p=0.9, top_k=40`
      );

      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: this.model,
          prompt: optimizedPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
          },
        },
        {
          timeout: 300000, // 5分鐘超時，因為 27B 模型較大
        }
      );

      const processingTime = Date.now() - startTime;

      logger.info(`[LLM_RESPONSE] LLM 回應處理完成，耗時: ${processingTime}ms`);
      logger.info(
        `[LLM_RESPONSE] 提示詞 tokens: ${response.data.prompt_eval_count || 0}`
      );
      logger.info(
        `[LLM_RESPONSE] 生成 tokens: ${response.data.eval_count || 0}`
      );
      logger.info(
        `[LLM_RESPONSE] 總 tokens: ${
          (response.data.prompt_eval_count || 0) +
          (response.data.eval_count || 0)
        }`
      );
      logger.info(
        `[LLM_RESPONSE] 回應內容長度: ${
          response.data.response?.length || 0
        } 字元`
      );

      // 打印 LLM 回應的前 500 字元作為預覽
      if (response.data.response) {
        const preview = response.data.response.substring(0, 500);
        logger.info(
          `[LLM_RESPONSE] 回應內容預覽:\n${preview}${
            response.data.response.length > 500 ? "..." : ""
          }`
        );
      }

      return {
        content: response.data.response,
        processingTime: processingTime,
        tokenUsage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
          total_tokens:
            (response.data.prompt_eval_count || 0) +
            (response.data.eval_count || 0),
        },
      };
    } catch (error) {
      logger.logError("本地 LLM API 呼叫失敗", error);
      logger.error(`[LLM_ERROR] 請求失敗，耗時: ${Date.now() - startTime}ms`);
      throw new Error(`本地 LLM API 錯誤: ${error.message}`);
    }
  }

  getModelName() {
    return this.model;
  }
}

module.exports = SummaryService;
