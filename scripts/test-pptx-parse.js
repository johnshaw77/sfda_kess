const JSZip = require("jszip");
const xml2js = require("xml2js");
const fs = require("fs");

async function parsePPTX(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // 獲取所有投影片
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
    );

    const slides = [];

    for (const slideFile of slideFiles) {
      const slideXml = await zip.files[slideFile].async("string");
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(slideXml);

      // 提取文字內容
      const textContent = extractText(result);
      slides.push({
        slide: slideFile,
        text: textContent,
      });
    }

    return slides;
  } catch (error) {
    console.error("Error parsing PPTX:", error);
    throw error;
  }
}

function extractText(xmlObj) {
  let text = "";

  function traverse(obj) {
    if (typeof obj === "string") {
      text += obj + " ";
    } else if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else if (typeof obj === "object" && obj !== null) {
      Object.values(obj).forEach(traverse);
    }
  }

  traverse(xmlObj);
  return text.trim();
}

// 使用範例
parsePPTX("test.pptx")
  .then((slides) => {
    console.log("Slides content:", slides);
  })
  .catch((err) => {
    console.error("Error:", err);
  });
