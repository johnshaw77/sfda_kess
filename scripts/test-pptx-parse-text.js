const JSZip = require("jszip");
const xml2js = require("xml2js");
const fs = require("fs");

async function extractTextFromPPTX(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // 獲取所有投影片
    const slideFiles = Object.keys(zip.files)
      .filter(
        (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
      )
      .sort(); // 確保順序

    const slides = [];

    for (const slideFile of slideFiles) {
      const slideXml = await zip.files[slideFile].async("string");
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(slideXml);

      // 只提取文字內容
      const textContent = extractTextOnly(result);
      if (textContent.trim()) {
        slides.push({
          slideNumber: slides.length + 1,
          text: textContent.trim(),
        });
      }
    }

    return slides;
  } catch (error) {
    console.error("Error parsing PPTX:", error);
    throw error;
  }
}

function extractTextOnly(xmlObj) {
  const texts = [];

  function findTextNodes(obj) {
    if (typeof obj === "string") {
      // 忽略純數字和特殊字符
      if (obj.trim() && !/^[\d\s\-_\.]+$/.test(obj.trim())) {
        texts.push(obj.trim());
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(findTextNodes);
    } else if (typeof obj === "object" && obj !== null) {
      // 專門尋找文字節點
      if (obj["a:t"]) {
        findTextNodes(obj["a:t"]);
      } else if (obj["a:r"] && obj["a:r"][0] && obj["a:r"][0]["a:t"]) {
        findTextNodes(obj["a:r"][0]["a:t"]);
      } else {
        Object.values(obj).forEach(findTextNodes);
      }
    }
  }

  findTextNodes(xmlObj);
  return texts.join(" ");
}

// 使用範例
extractTextFromPPTX("test.pptx")
  .then((slides) => {
    console.log("投影片文字內容：");
    slides.forEach((slide) => {
      console.log(`\n=== 投影片 ${slide.slideNumber} ===`);
      console.log(slide.text);
    });
  })
  .catch((err) => {
    console.error("Error:", err);
  });
