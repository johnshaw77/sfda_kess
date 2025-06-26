const fs = require("fs");
const path = require("path");

/**
 * 修正 EJS 檔案中被格式化破壞的 moment 語法
 */
function fixEjsMomentSyntax() {
  console.log("🔧 開始修正 EJS 檔案中的 moment 語法...");

  const viewsDir = path.join(__dirname, "..", "views");
  const ejsFiles = fs
    .readdirSync(viewsDir)
    .filter((file) => file.endsWith(".ejs"))
    .map((file) => path.join(viewsDir, file));

  let fixedCount = 0;

  ejsFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");

    // 修正被分行的 moment 格式化語法
    let fixedContent = content
      // 修正 moment(...).format('YYYY-MM-DD\nHH:mm:ss') 格式
      .replace(
        /moment\([^)]+\)\.format\('YYYY-MM-DD\s*\n\s*HH:mm:ss'\)/g,
        (match) => match.replace(/\s*\n\s*/, " ")
      )
      // 修正 moment(...).format('YYYY-MM-DD\nHH:mm') 格式
      .replace(
        /moment\([^)]+\)\.format\('YYYY-MM-DD\s*\n\s*HH:mm'\)/g,
        (match) => match.replace(/\s*\n\s*/, " ")
      )
      // 修正 <%= \n moment(...) 格式
      .replace(
        /<%=\s*\n\s*moment\([^)]+\)\.format\('([^']+)'\)\s*%>/g,
        (match, format) => {
          const momentMatch = match.match(/moment\([^)]+\)/);
          if (momentMatch) {
            return `<%= ${momentMatch[0]}.format('${format}') %>`;
          }
          return match;
        }
      );

    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent, "utf8");
      console.log(`✅ 修正了: ${path.basename(filePath)}`);
      fixedCount++;
    }
  });

  console.log(`🎉 完成！修正了 ${fixedCount} 個檔案`);

  // 檢查語法
  console.log("\n🧪 檢查 EJS 語法...");
  const { execSync } = require("child_process");

  ejsFiles.forEach((filePath) => {
    try {
      execSync(`npx ejs-lint "${filePath}"`, { stdio: "pipe" });
      console.log(`✅ ${path.basename(filePath)} 語法正確`);
    } catch (error) {
      console.error(`❌ ${path.basename(filePath)} 語法錯誤:`);
      console.error(error.stdout ? error.stdout.toString() : error.message);
    }
  });
}

if (require.main === module) {
  fixEjsMomentSyntax();
}

module.exports = { fixEjsMomentSyntax };
