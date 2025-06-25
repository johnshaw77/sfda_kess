const path = require("path");
const DocumentProcessor = require("./src/processor/document-processor");

// 測試檔案路徑
const testFilePath =
  "Z:\\TOJohn\\WWQ162 紀錄表單保存年限暨文件銷毀作業指示書.docx";

console.log("=== 檔案副檔名測試 ===");
console.log(`檔案路徑: ${testFilePath}`);
console.log(`path.extname(): ${path.extname(testFilePath)}`);
console.log(
  `path.extname().toLowerCase(): ${path.extname(testFilePath).toLowerCase()}`
);
console.log(`path.basename(): ${path.basename(testFilePath)}`);

// 測試各種情況
const testCases = [
  testFilePath,
  "Z:\\TOJohn\\WWQ162 紀錄表單保存年限暨文件銷毀作業指示書.docx",
  "Z:/TOJohn/WWQ162 紀錄表單保存年限暨文件銷毀作業指示書.docx",
  "\\\\server\\share\\test.docx",
  "test.docx",
];

console.log("\n=== 多種路徑格式測試 ===");
testCases.forEach((filePath, index) => {
  console.log(`\n測試案例 ${index + 1}:`);
  console.log(`路徑: ${filePath}`);
  console.log(`副檔名: ${path.extname(filePath)}`);
  console.log(`小寫副檔名: ${path.extname(filePath).toLowerCase()}`);
  console.log(`檔案名稱: ${path.basename(filePath)}`);
});

// 模擬檔案資訊物件
const testFileInfo = {
  fileName: path.basename(testFilePath),
  fileExtension: undefined, // 模擬問題情況
  filePath: testFilePath,
  eventType: "add",
};

console.log("\n=== 檔案資訊物件測試 ===");
console.log("原始 fileInfo:", testFileInfo);

// 模擬修復邏輯
if (!testFileInfo.fileExtension) {
  testFileInfo.fileExtension = path.extname(testFilePath).toLowerCase();
  console.log("修復後的 fileExtension:", testFileInfo.fileExtension);
}

// 測試文件處理器
const processor = new DocumentProcessor();
console.log("\n=== 支援的格式 ===");
console.log("支援的副檔名:", processor.getSupportedExtensions());
console.log("是否支援 .docx:", processor.isSupported(".docx"));
console.log("是否支援 .doc:", processor.isSupported(".doc"));
