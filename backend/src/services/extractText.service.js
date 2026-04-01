const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");

async function extractText({ buffer, mimeType }) {
  try {
    // Dacă este PDF
    if (mimeType === "application/pdf") {
      const data = await pdfParse(buffer);
      return (data.text || "").trim();
    }

    // Dacă este imagine (scan)
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