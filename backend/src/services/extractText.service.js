const PDFParser = require("pdf2json");
const Tesseract = require("tesseract.js");

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      let text = "";

      for (const page of pdfData.Pages || []) {
        for (const item of page.Texts || []) {
          for (const run of item.R || []) {
            text += decodeURIComponent(run.T) + " ";
          }
        }
      }

      resolve(text.trim());
    });

    pdfParser.parseBuffer(buffer);
  });
}

async function extractText({ buffer, mimeType }) {
  try {
    if (mimeType === "application/pdf") {
      return await extractPdfText(buffer);
    }

    if (/^image\//.test(mimeType)) {
      const result = await Tesseract.recognize(buffer, "ron+eng");
      return (result.data.text || "").trim();
    }

    return "";
  } catch (error) {
    console.error("Eroare la extragerea textului:", error.message);
    return "";
  }
}

module.exports = { extractText };