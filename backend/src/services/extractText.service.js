const pdfParsePackage = require("pdf-parse");
const Tesseract = require("tesseract.js");

const pdfParse =
  typeof pdfParsePackage === "function"
    ? pdfParsePackage
    : pdfParsePackage.default;

async function extractText({ buffer, mimeType }) {
  try {
    if (mimeType === "application/pdf") {
      if (!pdfParse) {
        throw new Error("pdfParse nu este disponibil.");
      }

      const data = await pdfParse(buffer);
      return (data.text || "").trim();
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