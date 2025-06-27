const SummaryService = require("./src/services/summary-service");

async function testExtraction() {
  console.log("=== 測試章節提取功能 ===\n");

  const summaryService = new SummaryService();

  // 使用剛才看到的 AI 回應內容
  const testContent = `## 1. 文件摘要
這份文件是一個系統錯誤訊息，指出無法讀取名為「~$Q1486 表單紀錄保存管理規範.doc」的 DOC 檔案。檔案位於 Y:\\TOJohn 路徑下，系統建議轉換成 DOCX 格式以支援內容提取。

## 2. 關鍵要點
- 系統無法讀取特定 DOC 文件。
- 建議將文件轉換為 DOCX 格式。
- 錯誤發生的具體時間和位置已明確記錄。

## 3. 關鍵字
系統錯誤, DOC 檔案, 轉換, DOCX, 內容提取

## 4. 實體識別
- 人物：無
- 組織：無
- 地點：Y:\\TOJohn
- 時間：2025/6/26 下午7:37:43

## 5. 文件分類
技術文檔（系統錯誤報告）

## 6. 可信度評估
8 分。文件提供了明確的檔案路徑、錯誤時間和詳細的解決建議，可信度高，但由於是系統自動生成的信息，缺少人工確認的因素，故扣兩分。`;

  // 測試提取功能
  console.log("1. 測試文件摘要提取：");
  const summary = summaryService.extractSection(testContent, "文件摘要");
  console.log(summary ? `✅ 成功: ${summary.substring(0, 100)}...` : "❌ 失敗");

  console.log("\n2. 測試關鍵要點提取：");
  const keyPointsRaw = summaryService.extractSection(testContent, "關鍵要點");
  console.log("原始內容:", keyPointsRaw);
  const keyPoints = summaryService.extractKeyPoints(testContent);
  console.log("解析結果:", keyPoints);

  console.log("\n3. 測試關鍵字提取：");
  const keywordsRaw = summaryService.extractSection(testContent, "關鍵字");
  console.log("原始內容:", keywordsRaw);
  const keywords = summaryService.extractKeywords(testContent);
  console.log("解析結果:", keywords);

  console.log("\n4. 測試實體識別提取：");
  const entitiesRaw = summaryService.extractSection(testContent, "實體識別");
  console.log("原始內容:", entitiesRaw);
  const entities = summaryService.extractEntities(testContent);
  console.log("解析結果:", entities);
}

testExtraction().catch(console.error);
