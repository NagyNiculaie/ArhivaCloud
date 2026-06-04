const PDFParser = require("pdf2json");
const Tesseract = require("tesseract.js");

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) => {
      console.error("PDF PARSER ERROR:", errData);
      reject(new Error(errData?.parserError || "Eroare la parsarea PDF-ului."));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        let text = "";

        for (const page of pdfData.Pages || []) {
          for (const item of page.Texts || []) {
            for (const run of item.R || []) {
              if (run.T) {
                text += safeDecode(run.T) + " ";
              }
            }
          }

          text += "\n";
        }

        resolve(text.replace(/\s+/g, " ").trim());
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

async function extractText({ buffer, mimeType }) {
  console.log("EXTRACT TEXT MIME TYPE:", mimeType);

  if (!buffer) {
    throw new Error("Buffer lipsă pentru extragerea textului.");
  }

  if (mimeType === "application/pdf") {
    const text = await extractPdfText(buffer);

    console.log("PDF TEXT LENGTH:", text.length);

    return text;
  }

  if (/^image\//.test(mimeType)) {
    const result = await Tesseract.recognize(buffer, "ron+eng");
    const text = (result.data.text || "").trim();

    console.log("IMAGE OCR TEXT LENGTH:", text.length);

    return text;
  }

  if (mimeType === "text/plain") {
    return buffer.toString("utf-8").trim();
  }

  return "";
}

module.exports = { extractText };