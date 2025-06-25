const config = require("../../config");

class PromptManager {
  constructor() {
    this.language = config.summary.language;
    this.maxLength = config.summary.maxLength;
  }

  /**
   * 建立針對 Gemma 3 優化的文件分析提示詞
   * @param {Object} documentData - 文件資料
   * @returns {string} 優化的提示詞
   */
  buildDocumentAnalysisPrompt(documentData) {
    return `你是一個專業的文件分析專家，請為以下文件進行詳細分析。

文件資訊：
- 檔案名稱：${documentData.fileName}
- 檔案類型：${documentData.fileExtension}
- 字數：${documentData.wordCount} 字

文件內容：
${documentData.content}

請按照以下格式提供分析結果（使用繁體中文）：

## 1. 文件摘要
（不超過 ${this.maxLength} 字的精簡摘要）

## 2. 關鍵要點
- 第一個重要要點
- 第二個重要要點
- 第三個重要要點
（列出 3-5 個最重要的要點）

## 3. 關鍵字
（用逗號分隔 5-10 個關鍵字）

## 4. 實體識別
- 人物：（人物名稱，如無則寫「無」）
- 組織：（組織名稱，如無則寫「無」）
- 地點：（地點名稱，如無則寫「無」）
- 時間：（時間資訊，如無則寫「無」）

## 5. 文件分類
（文件類型：如技術文檔、商業報告、學術論文、新聞報導等）

## 6. 可信度評估
（1-10 分，並簡述評估理由）

請確保回應格式清楚，方便後續處理。`;
  }

  /**
   * 建立針對特定文件類型的提示詞
   * @param {Object} documentData - 文件資料
   * @param {string} documentType - 文件類型
   * @returns {string} 特定類型的提示詞
   */
  buildSpecializedPrompt(documentData, documentType) {
    const basePrompt = this.buildDocumentAnalysisPrompt(documentData);

    switch (documentType) {
      case "technical":
        return (
          basePrompt +
          `\n\n特別注意：這是技術文檔，請特別關注技術細節、架構資訊、API 規格等技術要點。`
        );

      case "business":
        return (
          basePrompt +
          `\n\n特別注意：這是商業文檔，請特別關注商業策略、市場分析、財務數據等商業要點。`
        );

      case "academic":
        return (
          basePrompt +
          `\n\n特別注意：這是學術文檔，請特別關注研究方法、實驗結果、理論貢獻等學術要點。`
        );

      case "legal":
        return (
          basePrompt +
          `\n\n特別注意：這是法律文檔，請特別關注法律條文、權利義務、合規要求等法律要點。`
        );

      default:
        return basePrompt;
    }
  }

  /**
   * 建立批次處理提示詞
   * @param {Array} documentDataList - 文件資料陣列
   * @returns {string} 批次處理提示詞
   */
  buildBatchPrompt(documentDataList) {
    const documentSummaries = documentDataList
      .map(
        (doc, index) =>
          `文件 ${index + 1}：${doc.fileName}\n${doc.content.substring(
            0,
            200
          )}...`
      )
      .join("\n\n");

    return `請對以下 ${documentDataList.length} 個文件進行批次分析，為每個文件提供簡要摘要：

${documentSummaries}

請為每個文件提供：
1. 一句話摘要（不超過 50 字）
2. 主要主題
3. 文件重要性評級（1-5 分）

格式：
文件 1：[摘要] | [主題] | [評級]
文件 2：[摘要] | [主題] | [評級]
...`;
  }

  /**
   * 建立關鍵字提取提示詞
   * @param {string} content - 文件內容
   * @returns {string} 關鍵字提取提示詞
   */
  buildKeywordExtractionPrompt(content) {
    return `請從以下文件內容中提取最重要的關鍵字：

${content}

要求：
1. 提取 10-15 個最重要的關鍵字
2. 按重要性排序
3. 包含專有名詞、核心概念、技術術語
4. 用逗號分隔
5. 使用繁體中文

關鍵字：`;
  }

  /**
   * 建立實體識別提示詞
   * @param {string} content - 文件內容
   * @returns {string} 實體識別提示詞
   */
  buildEntityExtractionPrompt(content) {
    return `請從以下文件內容中識別並提取各類實體：

${content}

請識別以下類型的實體：
1. 人物：人名、職稱
2. 組織：公司、機構、團體名稱
3. 地點：國家、城市、地址
4. 時間：日期、時間段
5. 產品：產品名稱、品牌
6. 技術：技術術語、系統名稱

格式：
人物：[姓名1, 姓名2, ...]
組織：[組織1, 組織2, ...]
地點：[地點1, 地點2, ...]
時間：[時間1, 時間2, ...]
產品：[產品1, 產品2, ...]
技術：[技術1, 技術2, ...]

如果某個類別沒有找到相關實體，請寫「無」。`;
  }

  /**
   * 建立情感分析提示詞
   * @param {string} content - 文件內容
   * @returns {string} 情感分析提示詞
   */
  buildSentimentAnalysisPrompt(content) {
    return `請分析以下文件內容的情感傾向：

${content}

請提供：
1. 整體情感傾向：正面/中性/負面
2. 情感強度：1-5 分（1=很弱，5=很強）
3. 主要情感關鍵詞：列出體現情感的關鍵詞
4. 情感分析理由：簡述判斷依據

格式：
情感傾向：[正面/中性/負面]
情感強度：[1-5 分]
關鍵詞：[詞1, 詞2, 詞3, ...]
分析理由：[簡述原因]`;
  }

  /**
   * 根據文件類型自動選擇合適的提示詞
   * @param {Object} documentData - 文件資料
   * @returns {string} 最適合的提示詞
   */
  getOptimalPrompt(documentData) {
    const fileName = documentData.fileName.toLowerCase();
    const content = documentData.content.toLowerCase();

    // 根據檔名和內容自動判斷文件類型
    if (
      fileName.includes("api") ||
      fileName.includes("tech") ||
      content.includes("function") ||
      content.includes("class")
    ) {
      return this.buildSpecializedPrompt(documentData, "technical");
    } else if (
      fileName.includes("business") ||
      fileName.includes("report") ||
      content.includes("營收") ||
      content.includes("市場")
    ) {
      return this.buildSpecializedPrompt(documentData, "business");
    } else if (
      fileName.includes("research") ||
      fileName.includes("paper") ||
      content.includes("研究") ||
      content.includes("實驗")
    ) {
      return this.buildSpecializedPrompt(documentData, "academic");
    } else if (
      fileName.includes("contract") ||
      fileName.includes("legal") ||
      content.includes("合約") ||
      content.includes("法律")
    ) {
      return this.buildSpecializedPrompt(documentData, "legal");
    } else {
      return this.buildDocumentAnalysisPrompt(documentData);
    }
  }
}

module.exports = PromptManager;
