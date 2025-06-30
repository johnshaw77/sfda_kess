const path = require("path");
const pptx2jsonRaw = require("pptx2json");

const pptxPath = path.join(__dirname, "test.pptx");

console.log("typeof pptx2jsonRaw:", typeof pptx2jsonRaw);
console.log("pptx2jsonRaw prototype:", pptx2jsonRaw.prototype);

(async () => {
  // 嘗試 function 方式
  try {
    console.log("\n嘗試: 直接呼叫 function 方式");
    const result = await pptx2jsonRaw(pptxPath);
    console.log(
      "function 方式成功! result.slides.length=",
      result.slides?.length
    );
  } catch (e) {
    console.log("function 方式失敗:", e.message);
  }

  // 嘗試 class 方式
  try {
    console.log("\n嘗試: new class 方式");
    const parser = new pptx2jsonRaw();
    if (typeof parser.parse === "function") {
      const result = await parser.parse(pptxPath);
      console.log(
        "class 方式成功! result.slides.length=",
        result.slides?.length
      );
    } else {
      console.log("class 方式失敗: parse 不是 function");
    }
  } catch (e) {
    console.log("class 方式失敗:", e.message);
  }
})();
