const mysql = require("mysql2/promise");
const config = require("./config");

async function reprocessSummaries() {
  try {
    const connection = await mysql.createConnection(config.database);

    console.log("🔄 重新處理現有摘要資料...\n");

    // 獲取所有有摘要內容但缺少關鍵要點/關鍵字的記錄
    const [summaries] = await connection.execute(`
      SELECT id, summary_text 
      FROM kess_summaries 
      WHERE summary_text IS NOT NULL 
      AND (key_points IS NULL OR JSON_LENGTH(key_points) = 0)
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`找到 ${summaries.length} 筆需要重新處理的摘要`);

    for (const summary of summaries) {
      console.log(`\n處理摘要 ID: ${summary.id}`);

      const content = summary.summary_text;
      console.log("原始摘要內容前200字：");
      console.log(content.substring(0, 200) + "...\n");

      // 改進的解析邏輯
      const keyPoints = extractKeyPoints(content);
      const keywords = extractKeywords(content);
      const entities = extractEntities(content);

      console.log("提取結果：");
      console.log("關鍵要點：", keyPoints);
      console.log("關鍵字：", keywords);
      console.log("實體：", entities);

      // 更新資料庫
      await connection.execute(
        `
        UPDATE kess_summaries 
        SET key_points = ?, keywords = ?, entities = ?
        WHERE id = ?
      `,
        [
          JSON.stringify(keyPoints),
          JSON.stringify(keywords),
          JSON.stringify(entities),
          summary.id,
        ]
      );

      console.log("✅ 更新完成");
    }

    await connection.end();
    console.log("\n🎉 所有摘要重新處理完成！");
  } catch (error) {
    console.error("❌ 重新處理時發生錯誤:", error);
  }
}

// 改進的解析函數
function extractKeyPoints(content) {
  const patterns = [
    /##\s*\d+\.\s*關鍵要點([\s\S]*?)(?=##\s*\d+\.|$)/i,
    /關鍵要點[：:]([\s\S]*?)(?=\n\n|##|$)/i,
    /關鍵要點\s*\n([\s\S]*?)(?=\n\n|##|$)/i,
  ];

  for (const regex of patterns) {
    const match = content.match(regex);
    if (match && match[1].trim()) {
      const keyPointsSection = match[1].trim();
      const points = keyPointsSection
        .split(/[-•]\s*/)
        .map((point) => point.trim())
        .filter(
          (point) =>
            point.length > 0 && !point.match(/^第[一二三四五六七八九十\d]+個/)
        )
        .slice(0, 10); // 最多10個要點

      if (points.length > 0) {
        return points;
      }
    }
  }

  return [];
}

function extractKeywords(content) {
  const patterns = [
    /##\s*\d+\.\s*關鍵字([\s\S]*?)(?=##\s*\d+\.|$)/i,
    /關鍵字[：:]([\s\S]*?)(?=\n\n|##|$)/i,
    /關鍵字\s*\n([\s\S]*?)(?=\n\n|##|$)/i,
  ];

  for (const regex of patterns) {
    const match = content.match(regex);
    if (match && match[1].trim()) {
      const keywordsSection = match[1].trim();
      const keywords = keywordsSection
        .split(/[,，、]/)
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0 && keyword.length < 50)
        .slice(0, 15); // 最多15個關鍵字

      if (keywords.length > 0) {
        return keywords;
      }
    }
  }

  return [];
}

function extractEntities(content) {
  const entities = {
    persons: [],
    organizations: [],
    locations: [],
    dates: [],
    products: [],
  };

  const patterns = [
    /##\s*\d+\.\s*實體識別([\s\S]*?)(?=##\s*\d+\.|$)/i,
    /實體識別[：:]([\s\S]*?)(?=\n\n|##|$)/i,
  ];

  for (const regex of patterns) {
    const match = content.match(regex);
    if (match && match[1].trim()) {
      const entitiesSection = match[1].trim();
      const lines = entitiesSection.split("\n");

      for (const line of lines) {
        if (line.includes("人物") || line.includes("人員")) {
          const persons = extractEntitiesFromLine(line);
          entities.persons = persons;
        } else if (line.includes("組織") || line.includes("機構")) {
          const organizations = extractEntitiesFromLine(line);
          entities.organizations = organizations;
        } else if (line.includes("地點") || line.includes("位置")) {
          const locations = extractEntitiesFromLine(line);
          entities.locations = locations;
        } else if (line.includes("時間") || line.includes("日期")) {
          const dates = extractEntitiesFromLine(line);
          entities.dates = dates;
        }
      }
    }
  }

  return entities;
}

function extractEntitiesFromLine(line) {
  const colonIndex = line.indexOf("：") || line.indexOf(":");
  if (colonIndex === -1) return [];

  const content = line.substring(colonIndex + 1).trim();
  if (content === "無" || content === "N/A" || content === "") return [];

  return content
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10);
}

if (require.main === module) {
  reprocessSummaries();
}

module.exports = { reprocessSummaries };
