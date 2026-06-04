import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs";
import { getToken, getUser, logout } from "../Utils/auth";
import { useNavigate } from "react-router-dom";
import AiStickyNote from "../components/AiStickyNote";

const API_URL = import.meta.env.VITE_API_URL;

const CATEGORY_LABELS = {
  factura: "Factură",
  bon: "Bon fiscal",
  nir: "NIR",
  contract: "Contract",
  extras_bancar: "Extras bancar",
  declaratie: "Declarație",
  stat_plata: "Stat plată",
  chitanta: "Chitanță",
  ordin_plata: "Ordin de plată",
  altul: "Altul",
};

const MONTH_LABELS = {
  1: "Ianuarie",
  2: "Februarie",
  3: "Martie",
  4: "Aprilie",
  5: "Mai",
  6: "Iunie",
  7: "Iulie",
  8: "August",
  9: "Septembrie",
  10: "Octombrie",
  11: "Noiembrie",
  12: "Decembrie",
};

const PROCESSING_LABELS = {
  uploaded: "Încărcat",
  processing: "Se procesează",
  done: "Procesat",
  failed: "Eroare procesare",
};


const STATUS_FILTER_LABELS = {
  all: "Toate statusurile",
  done: "Procesate",
  processing: "În procesare",
  failed: "Cu eroare",
  uploaded: "Încărcate",
};

function formatCategory(category) {
  return CATEGORY_LABELS[category] || category || "Altul";
}

function formatProcessingStatus(status) {
  return PROCESSING_LABELS[status] || status || "Necunoscut";
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ro-RO");
}

function formatAmount(amount, currency = "RON") {
  if (typeof amount !== "number") return "";

  return `${amount.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "RON"}`;
}

function formatFileSize(size) {
  if (!size || typeof size !== "number") return "";

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeText(value = "") {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getProcessingBadgeStyle(status) {
  if (status === "done") return styles.statusOk;
  if (status === "processing") return styles.statusProcessing;
  if (status === "failed") return styles.statusError;

  return styles.statusWarn;
}

function isAcceptedFile(file) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const fileInputRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [message, setMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [aiNotes, setAiNotes] = useState([]);
  const [askLoading, setAskLoading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [processingStatusFilter, setProcessingStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");

  const loadDocs = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      setDocs(res.data.documents || []);
    } catch (err) {
      console.error("Eroare la listare:", err);
      setMessage("Eroare la încărcarea documentelor.");
    }
  };


  const loadStats = async () => {
    try {
      setStatsLoading(true);

      const res = await axios.get(`${API_URL}/documents/stats`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      setStatsData(res.data.stats || null);
    } catch (err) {
      console.error("Eroare la statistici:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
    loadStats();
  }, []);

  const hasProcessingDocs = docs.some(
    (doc) => doc.processingStatus === "processing"
  );

  useEffect(() => {
    if (!hasProcessingDocs) return;

    const intervalId = setInterval(() => {
      loadDocs();
      loadStats();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [hasProcessingDocs]);

  const addSelectedFiles = (files) => {
    const incomingFiles = Array.from(files || []);
    const acceptedFiles = incomingFiles.filter(isAcceptedFile);
    const rejectedCount = incomingFiles.length - acceptedFiles.length;

    if (rejectedCount > 0) {
      setMessage(
        `${rejectedCount} fișier(e) ignorate. Sunt acceptate doar PDF-uri și imagini.`
      );
    }

    if (acceptedFiles.length === 0) return;

    setSelectedFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      const uniqueFiles = acceptedFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      return [...prev, ...uniqueFiles];
    });
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputFiles = (event) => {
    addSelectedFiles(event.target.files);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);
    addSelectedFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const uploadSingleFile = async (currentFile) => {
    const formData = new FormData();
    formData.append("file", currentFile);

    return axios.post(`${API_URL}/documents/upload`, formData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "multipart/form-data",
      },
    });
  };

  const uploadFiles = async () => {
    try {
      if (selectedFiles.length === 0) {
        setMessage("Selectează sau trage cel puțin un fișier.");
        return;
      }

      setLoading(true);
      setUploadProgress({
        current: 0,
        total: selectedFiles.length,
      });

      let uploadedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const failedFiles = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const currentFile = selectedFiles[i];

        setUploadProgress({
          current: i + 1,
          total: selectedFiles.length,
        });

        setMessage(
          `Se încarcă ${i + 1}/${selectedFiles.length}: ${currentFile.name}`
        );

        try {
          const res = await uploadSingleFile(currentFile);

          console.log("Upload OK:", res.data);
          uploadedCount++;

          await loadDocs();
          await loadStats();
        } catch (err) {
          const isDuplicate = err.response?.status === 409 && err.response?.data?.duplicate;

          if (isDuplicate) {
            duplicateCount++;
            console.warn("Document duplicat ignorat:", currentFile.name);
          } else {
            failedCount++;
            failedFiles.push(currentFile.name);
            console.error("Eroare upload pentru fișier:", currentFile.name, err);
          }
        }
      }

      const messageParts = [];

      if (uploadedCount > 0) {
        messageParts.push(
          `${uploadedCount} document(e) încărcate. Analiza AI rulează în fundal.`
        );
      }

      if (duplicateCount > 0) {
        messageParts.push(
          `${duplicateCount} document(e) duplicate ignorate.`
        );
      }

      if (failedCount > 0) {
        messageParts.push(
          `${failedCount} document(e) nu au putut fi încărcate: ${failedFiles.join(", ")}.`
        );
      }

      setMessage(messageParts.join(" "));

      if (uploadedCount > 0 || duplicateCount > 0) {
        clearSelectedFiles();
      }

      await loadDocs();
      await loadStats();
    } catch (err) {
      console.error("Eroare upload:", err);
      setMessage(
        "Eroare upload: " + (err.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
      setUploadProgress({
        current: 0,
        total: 0,
      });
    }
  };


  const deleteDocument = async (id) => {
    try {
      await axios.delete(`${API_URL}/documents/${id}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      setMessage("Document șters cu succes.");
      await loadDocs();
      await loadStats();
    } catch (err) {
      console.error("Eroare la ștergere:", err);
      setMessage(
        "Eroare la ștergere: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const semanticSearch = async () => {
    try {
      if (!searchQuery.trim()) {
        setMessage("Scrie ceva pentru căutare.");
        return;
      }

      setSearchLoading(true);
      setMessage("Se caută în documente...");

      const res = await axios.post(
        `${API_URL}/documents/semantic-search`,
        { query: searchQuery },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      setSearchResults(res.data.results || []);
      setMessage("Căutare finalizată.");
    } catch (err) {
      console.error("Eroare semantic search:", err);
      setMessage(
        "Eroare la căutare: " + (err.response?.data?.error || err.message)
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const askDocuments = async () => {
    try {
      const currentQuestion = question.trim();

      if (!currentQuestion) {
        setMessage("Scrie o întrebare.");
        return;
      }

      setAskLoading(true);
      setMessage("Se analizează documentele...");

      const res = await axios.post(
        `${API_URL}/documents/ask`,
        { question: currentQuestion },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      setAiNotes((prev) => [
        {
          id: Date.now(),
          question: currentQuestion,
          answer: res.data.answer || "",
          sources: res.data.sources || [],
        },
        ...prev,
      ]);

      setQuestion("");
      setMessage("Analiză finalizată.");
    } catch (err) {
      console.error("Ask AI error:", err);
      setMessage("Eroare AI: " + (err.response?.data?.error || err.message));
    } finally {
      setAskLoading(false);
    }
  };


  const reprocessDocument = async (id) => {
    try {
      setMessage("Reprocesarea documentului a pornit...");

      const res = await axios.post(
        `${API_URL}/documents/${id}/reprocess`,
        {},
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      setMessage(
        res.data.message ||
          "Reprocesarea a pornit. Documentul se actualizează automat."
      );

      await loadDocs();
      await loadStats();
    } catch (err) {
      console.error("Eroare la reprocesare:", err);
      setMessage(
        "Eroare la reprocesare: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const availableCategories = Array.from(
    new Set(docs.map((doc) => doc.category).filter(Boolean))
  ).sort();

  const availableYears = Array.from(
    new Set(docs.map((doc) => doc.year).filter(Boolean))
  ).sort((a, b) => b - a);

  const availableMonths = Array.from(
    new Set(docs.map((doc) => doc.month).filter(Boolean))
  ).sort((a, b) => a - b);


  const availableProcessingStatuses = Array.from(
    new Set(docs.map((doc) => doc.processingStatus).filter(Boolean))
  ).sort();

  const filteredDocs = docs.filter((doc) => {
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;

    const matchesYear =
      yearFilter === "all" || String(doc.year) === String(yearFilter);

    const matchesMonth =
      monthFilter === "all" || String(doc.month) === String(monthFilter);

    const matchesProcessingStatus =
      processingStatusFilter === "all" ||
      doc.processingStatus === processingStatusFilter;

    const matchesSupplier =
      !supplierFilter.trim() ||
      normalizeText(doc.supplier).includes(normalizeText(supplierFilter)) ||
      normalizeText(doc.file?.originalName).includes(
        normalizeText(supplierFilter)
      );

    return (
      matchesCategory &&
      matchesYear &&
      matchesMonth &&
      matchesProcessingStatus &&
      matchesSupplier
    );
  });

  const classifiedCount = docs.filter(
    (doc) => doc.classificationStatus === "classified"
  ).length;

  const processingCount = docs.filter(
    (doc) => doc.processingStatus === "processing"
  ).length;

  const failedCount = docs.filter(
    (doc) => doc.processingStatus === "failed"
  ).length;

  const resetArchiveFilters = () => {
    setCategoryFilter("all");
    setYearFilter("all");
    setMonthFilter("all");
    setProcessingStatusFilter("all");
    setSupplierFilter("");
  };


  const exportDocumentsToExcel = async () => {
    if (filteredDocs.length === 0) {
      setMessage("Nu există documente de exportat pentru filtrele selectate.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ArhivIQ";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Documente");

    worksheet.columns = [
      { header: "Nume fișier", key: "fileName", width: 42 },
      { header: "Categorie", key: "category", width: 18 },
      { header: "Status procesare", key: "processingStatus", width: 18 },
      { header: "Status clasificare", key: "classificationStatus", width: 18 },
      { header: "Furnizor", key: "supplier", width: 32 },
      { header: "Data document", key: "documentDate", width: 16 },
      { header: "An", key: "year", width: 10 },
      { header: "Lună", key: "month", width: 16 },
      { header: "Total", key: "totalAmount", width: 14 },
      { header: "Monedă", key: "currency", width: 10 },
      { header: "Rezumat IA", key: "aiSummary", width: 46 },
      { header: "Taguri", key: "tags", width: 34 },
      { header: "URL document", key: "url", width: 70 },
    ];

    filteredDocs.forEach((doc) => {
      worksheet.addRow({
        fileName: doc.file?.originalName || "",
        category: formatCategory(doc.category),
        processingStatus: formatProcessingStatus(doc.processingStatus),
        classificationStatus: doc.classificationStatus || "",
        supplier: doc.supplier || "",
        documentDate: formatDate(doc.documentDate),
        year: doc.year || "",
        month: doc.month ? MONTH_LABELS[doc.month] || doc.month : "",
        totalAmount:
          typeof doc.totalAmount === "number" ? doc.totalAmount : "",
        currency: doc.currency || "",
        aiSummary: doc.aiSummary || "",
        tags: Array.isArray(doc.tags) ? doc.tags.join(", ") : "",
        url: doc.file?.url || "",
      });
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: "A1",
      to: "M1",
    };

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      row.height = 42;

      row.eachCell((cell) => {
        cell.alignment = {
          vertical: "top",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        });
      }
    });

    worksheet.getColumn("totalAmount").numFmt = '#,##0.00';
    worksheet.getColumn("url").eachCell((cell, rowNumber) => {
      if (rowNumber === 1 || !cell.value) return;

      cell.value = {
        text: "Deschide document",
        hyperlink: cell.value,
      };

      cell.font = {
        color: { argb: "FF2563EB" },
        underline: true,
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `arhiva-documente-${today}.xlsx`;
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setMessage(`Export Excel generat: ${filteredDocs.length} document(e).`);
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoRow}>
  <img src="/arhiviq.svg" alt="ArhivIQ" style={styles.logoIcon} />
  <h2 style={styles.logo}>ArhivIQ</h2>
</div>

        <p style={styles.userText}>
          Bun venit, {user?.name || "Utilizator"}
        </p>

        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Arhiva ta inteligenta!</h1>
          <p style={styles.subtitle}>
            Încarcă, analizează și organizează automat documentele financiare cu ajutorul AI.
          </p>
        </div>

        <section style={styles.uploadCard}>
          <h3 style={styles.sectionTitle}>Upload documente</h3>

          <div
            style={{
              ...styles.dropZone,
              ...(dragActive ? styles.dropZoneActive : {}),
            }}
            onClick={openFileDialog}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleInputFiles}
              style={styles.hiddenFileInput}
            />

            <div style={styles.dropIcon}>📂</div>

            <strong style={styles.dropTitle}>
              Trage documentele aici sau apasă pentru selectare
            </strong>

            <span style={styles.dropSubtitle}>
              Poți încărca mai multe PDF-uri, JPG-uri sau PNG-uri odată.
            </span>
          </div>

          {selectedFiles.length > 0 && (
            <div style={styles.selectedFilesBox}>
              <div style={styles.selectedFilesHeader}>
                <strong>{selectedFiles.length} fișier(e) selectate</strong>

                <button
                  type="button"
                  style={styles.smallGhostBtn}
                  onClick={clearSelectedFiles}
                  disabled={loading}
                >
                  Golește lista
                </button>
              </div>

              <div style={styles.selectedFilesList}>
                {selectedFiles.map((selectedFile, index) => (
                  <div
                    key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                    style={styles.selectedFileItem}
                  >
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <p style={styles.selectedFileMeta}>
                        {selectedFile.type || "Fișier"} •{" "}
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>

                    <button
                      type="button"
                      style={styles.removeFileBtn}
                      onClick={() => removeSelectedFile(index)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.uploadActions}>
            <button
              style={styles.primaryBtn}
              onClick={uploadFiles}
              disabled={loading || selectedFiles.length === 0}
            >
              {loading
                ? `Se încarcă ${uploadProgress.current}/${uploadProgress.total}`
                : selectedFiles.length > 1
                ? "Upload toate documentele"
                : "Upload document"}
            </button>

            {selectedFiles.length > 0 && (
              <span style={styles.uploadCounter}>
                {selectedFiles.length} fișier(e) pregătite pentru upload
              </span>
            )}
          </div>

          {message && <p style={styles.message}>{message}</p>}

          {hasProcessingDocs && (
            <p style={styles.processingHint}>
              {processingCount} document(e) se procesează în fundal. Lista se
              actualizează automat.
            </p>
          )}
        </section>

        <section style={styles.searchCard}>
          <h3 style={styles.sectionTitle}>
            Căutare inteligentă în documente
          </h3>

          <div style={styles.searchRow}>
            <input
              type="text"
              placeholder="Caută după conținut: facturi, contracte, plăți, sume, furnizori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />

            <button
              onClick={semanticSearch}
              disabled={searchLoading}
              style={styles.primaryBtn}
            >
              {searchLoading ? "Se caută..." : "Caută"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={styles.resultsBox}>
              {searchResults.map((item) => (
                <div
                  key={item.chunk?.id || item.document._id}
                  style={styles.resultItem}
                >
                  <strong>{item.document.file?.originalName}</strong>

                  <p style={styles.docMeta}>
                    Scor relevanță: {item.score.toFixed(3)}
                  </p>

                  <div style={styles.cardTopLine}>
                    {item.document.category && (
                      <span style={styles.badge}>
                        {formatCategory(item.document.category)}
                      </span>
                    )}

                    {item.document.processingStatus && (
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getProcessingBadgeStyle(
                            item.document.processingStatus
                          ),
                        }}
                      >
                        {formatProcessingStatus(item.document.processingStatus)}
                      </span>
                    )}
                  </div>

                  {item.document.supplier && (
                    <p style={styles.docInfo}>
                      Furnizor: {item.document.supplier}
                    </p>
                  )}

                  <a
                    href={item.document.file?.url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.previewBtn}
                  >
                    Preview
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.askCard}>
          <h3 style={styles.sectionTitle}>Întreabă documentele tale</h3>

          <div style={styles.searchRow}>
            <input
              type="text"
              placeholder="Ex: Care este valoarea totală din factura Vodafone?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !askLoading) {
                  askDocuments();
                }
              }}
              style={styles.searchInput}
            />

            <button
              onClick={askDocuments}
              disabled={askLoading}
              style={styles.primaryBtn}
            >
              {askLoading ? "Se analizează..." : "Întreabă"}
            </button>
          </div>

          {hasProcessingDocs && (
            <p style={styles.processingHint}>
              Unele documente încă se procesează. IA poate răspunde complet doar
              după finalizarea procesării.
            </p>
          )}

          {aiNotes.length > 0 && (
            <p style={styles.aiHistoryInfo}>
              Ai {aiNotes.length} răspuns(uri) AI în istoric.
            </p>
          )}
        </section>


        <section style={styles.statsCard}>
          <div style={styles.statsHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Statistici arhivă</h3>
              <p style={styles.statsSubtitle}>
                Statistici calculate exact din documentele salvate, fără cost AI.
              </p>
            </div>

            <button style={styles.secondaryBtn} onClick={loadStats}>
              Actualizează statistici
            </button>
          </div>

          {statsLoading && !statsData ? (
            <div style={styles.emptyBox}>Se încarcă statisticile...</div>
          ) : !statsData ? (
            <div style={styles.emptyBox}>Nu există statistici disponibile încă.</div>
          ) : (
            <>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Total documente</span>
                  <strong style={styles.statValue}>
                    {statsData.totalDocuments || 0}
                  </strong>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Procesate</span>
                  <strong style={styles.statValue}>
                    {statsData.doneCount || 0}
                  </strong>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>În procesare</span>
                  <strong style={styles.statValue}>
                    {statsData.processingCount || 0}
                  </strong>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Cu eroare</span>
                  <strong style={styles.statValue}>
                    {statsData.failedCount || 0}
                  </strong>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Documente cu sumă</span>
                  <strong style={styles.statValue}>
                    {statsData.documentsWithAmount || 0}
                  </strong>
                </div>
              </div>

              <div style={styles.statsDetailsGrid}>
                <div style={styles.statsPanel}>
                  <h4 style={styles.statsPanelTitle}>Totaluri detectate</h4>

                  {statsData.totalsByCurrency?.length > 0 ? (
                    <div style={styles.statsList}>
                      {statsData.totalsByCurrency.map((item) => (
                        <div style={styles.statsListItem} key={item.currency}>
                          <span>{item.currency}</span>
                          <strong>{formatAmount(item.total, item.currency)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={styles.statsEmptyText}>
                      Nu există sume detectate încă.
                    </p>
                  )}
                </div>

                <div style={styles.statsPanel}>
                  <h4 style={styles.statsPanelTitle}>Categorii</h4>

                  <div style={styles.statsChips}>
                    {statsData.categoryCounts?.slice(0, 8).map((item) => (
                      <span style={styles.statsChip} key={item.key}>
                        {formatCategory(item.key)}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={styles.statsPanel}>
                  <h4 style={styles.statsPanelTitle}>Top furnizori</h4>

                  {statsData.supplierCounts?.length > 0 ? (
                    <div style={styles.statsList}>
                      {statsData.supplierCounts.slice(0, 5).map((item) => (
                        <div style={styles.statsListItem} key={item.key}>
                          <span>{item.key}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={styles.statsEmptyText}>
                      Nu există furnizori detectați încă.
                    </p>
                  )}
                </div>

                <div style={styles.statsPanel}>
                  <h4 style={styles.statsPanelTitle}>Ani / luni</h4>

                  <div style={styles.statsChips}>
                    {statsData.yearCounts?.slice(0, 5).map((item) => (
                      <span style={styles.statsChip} key={item.key}>
                        {item.key}: {item.count}
                      </span>
                    ))}

                    {statsData.monthCounts?.slice(0, 6).map((item) => (
                      <span style={styles.statsChip} key={`month-${item.key}`}>
                        {MONTH_LABELS[item.key] || item.key}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section style={styles.docsSection}>
          <div style={styles.docsHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Documentele mele</h3>
              <p style={styles.archiveStats}>
                {docs.length} document(e) total • {classifiedCount} clasificate
                de IA • {processingCount} în procesare • {failedCount} cu eroare
                • {filteredDocs.length} afișate
              </p>
            </div>

            <div style={styles.docsHeaderActions}>
              <button style={styles.exportBtn} onClick={exportDocumentsToExcel}>
                Export Excel
              </button>

              <button style={styles.secondaryBtn} onClick={loadDocs}>
                Reîncarcă
              </button>
            </div>
          </div>

          <div style={styles.filtersCard}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Categorie</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={styles.filterInput}
              >
                <option value="all">Toate categoriile</option>
                {availableCategories.map((category) => (
                  <option value={category} key={category}>
                    {formatCategory(category)}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>An</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                style={styles.filterInput}
              >
                <option value="all">Toți anii</option>
                {availableYears.map((year) => (
                  <option value={year} key={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Lună</label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                style={styles.filterInput}
              >
                <option value="all">Toate lunile</option>
                {availableMonths.map((month) => (
                  <option value={month} key={month}>
                    {MONTH_LABELS[month] || month}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Status procesare</label>
              <select
                value={processingStatusFilter}
                onChange={(e) => setProcessingStatusFilter(e.target.value)}
                style={styles.filterInput}
              >
                <option value="all">Toate statusurile</option>
                {availableProcessingStatuses.map((status) => (
                  <option value={status} key={status}>
                    {STATUS_FILTER_LABELS[status] ||
                      formatProcessingStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Furnizor / fișier</label>
              <input
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                placeholder="Ex: Kessel, Vodafone, pompă..."
                style={styles.filterInput}
              />
            </div>

            <button style={styles.clearBtn} onClick={resetArchiveFilters}>
              Resetează filtre
            </button>
          </div>

          {processingStatusFilter !== "all" && (
            <p style={styles.activeFilterHint}>
              Filtru activ: {STATUS_FILTER_LABELS[processingStatusFilter] ||
                formatProcessingStatus(processingStatusFilter)}
            </p>
          )}

          {docs.length === 0 ? (
            <div style={styles.emptyBox}>Nu există documente încă.</div>
          ) : filteredDocs.length === 0 ? (
            <div style={styles.emptyBox}>
              Nu există documente pentru filtrele selectate.
            </div>
          ) : (
            <div style={styles.docsGrid}>
              {filteredDocs.map((doc) => {
                const documentDate = formatDate(doc.documentDate);
                const amount = formatAmount(doc.totalAmount, doc.currency);
                const monthLabel = doc.month ? MONTH_LABELS[doc.month] : "";
                const isProcessing = doc.processingStatus === "processing";
                const hasFailed = doc.processingStatus === "failed";

                return (
                  <div key={doc._id} style={styles.docCard}>
                    <div>
                      <div style={styles.cardTopLine}>
                        <span style={styles.badge}>
                          {formatCategory(doc.category)}
                        </span>

                        {doc.processingStatus && (
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...getProcessingBadgeStyle(doc.processingStatus),
                            }}
                          >
                            {formatProcessingStatus(doc.processingStatus)}
                          </span>
                        )}

                        {doc.classificationStatus &&
                          doc.classificationStatus !== "pending" && (
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...(doc.classificationStatus === "classified"
                                  ? styles.statusOk
                                  : styles.statusWarn),
                              }}
                            >
                              {doc.classificationStatus}
                            </span>
                          )}
                      </div>

                      <h4 style={styles.docTitle}>{doc.file?.originalName}</h4>

                      <p style={styles.docMeta}>
                        {doc.file?.mimeType || "Fișier"}
                      </p>

                      {isProcessing && (
                        <div style={styles.processingBox}>
                          <strong>Se procesează AI...</strong>
                          <span>
                            Documentul a fost încărcat. OCR-ul, clasificarea și
                            indexarea rulează în fundal.
                          </span>
                        </div>
                      )}

                      {hasFailed && (
                        <div style={styles.errorBox}>
                          <strong>Procesare eșuată</strong>
                          <span>
                            {doc.processingError ||
                              "Nu s-a putut finaliza procesarea AI."}
                          </span>
                        </div>
                      )}

                      <div style={styles.docInfoBox}>
                        {doc.supplier && (
                          <p style={styles.docInfo}>
                            <strong>Furnizor:</strong> {doc.supplier}
                          </p>
                        )}

                        {documentDate && (
                          <p style={styles.docInfo}>
                            <strong>Data:</strong> {documentDate}
                          </p>
                        )}

                        {(doc.year || doc.month) && (
                          <p style={styles.docInfo}>
                            <strong>Perioadă:</strong>{" "}
                            {monthLabel || doc.month || "-"} {doc.year || ""}
                          </p>
                        )}

                        {amount && (
                          <p style={styles.docInfo}>
                            <strong>Total:</strong> {amount}
                          </p>
                        )}

                        {doc.aiSummary && (
                          <p style={styles.docSummary}>{doc.aiSummary}</p>
                        )}

                        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                          <div style={styles.tagsRow}>
                            {doc.tags.slice(0, 5).map((tag) => (
                              <span style={styles.tag} key={tag}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.docActions}>
                      <a
                        href={doc.file?.url}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.previewBtn}
                      >
                        Preview
                      </a>

                      <button
                        onClick={() => reprocessDocument(doc._id)}
                        style={styles.reprocessBtn}
                        disabled={doc.processingStatus === "processing"}
                        title={
                          doc.processingStatus === "processing"
                            ? "Documentul se procesează deja"
                            : "Rulează din nou OCR, clasificare și indexare"
                        }
                      >
                        Reprocesează IA
                      </button>

                      <button
                        onClick={() => deleteDocument(doc._id)}
                        style={styles.deleteBtn}
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AiStickyNote
        notes={aiNotes}
        onClose={() => setAiNotes([])}
        onDeleteNote={(id) =>
          setAiNotes((prev) => prev.filter((note) => note.id !== id))
        }
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
  },

  sidebar: {
    width: "250px",
    backgroundColor: "#111827",
    borderRight: "1px solid #1f2937",
    padding: "28px 20px",
  },

  logo: {
    margin: 0,
    fontSize: "26px",
  },
  logoRow: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
},

logoIcon: {
  width: "64px",
  height: "64px",
  borderRadius: "16px",
  objectFit: "cover",
  boxShadow: "0 0 18px rgba(56, 189, 248, 0.35)",
},
  userText: {
    marginTop: "16px",
    color: "#cbd5e1",
  },

  logoutBtn: {
    marginTop: "20px",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    width: "100%",
  },

  main: {
    flex: 1,
    padding: "32px",
  },

  header: {
    marginBottom: "24px",
  },

  title: {
    margin: 0,
    fontSize: "36px",
  },

  subtitle: {
    color: "#94a3b8",
    marginTop: "8px",
  },

  uploadCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "24px",
  },

  dropZone: {
    border: "2px dashed #334155",
    backgroundColor: "#0f172a",
    borderRadius: "18px",
    padding: "28px",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    gap: "8px",
    transition: "0.2s ease",
  },

  dropZoneActive: {
    borderColor: "#6366f1",
    backgroundColor: "#111c3a",
    transform: "scale(1.01)",
  },

  hiddenFileInput: {
    display: "none",
  },

  dropIcon: {
    fontSize: "34px",
  },

  dropTitle: {
    fontSize: "18px",
  },

  dropSubtitle: {
    color: "#94a3b8",
    fontSize: "14px",
  },

  selectedFilesBox: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "16px",
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
  },

  selectedFilesHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "12px",
  },

  selectedFilesList: {
    display: "grid",
    gap: "10px",
  },

  selectedFileItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
  },

  selectedFileMeta: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: "13px",
  },

  smallGhostBtn: {
    padding: "7px 10px",
    borderRadius: "10px",
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: "bold",
  },

  removeFileBtn: {
    minWidth: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },

  uploadActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },

  uploadCounter: {
    color: "#94a3b8",
    fontSize: "14px",
  },

  searchCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "24px",
  },

  askCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "24px",
  },


  statsCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "24px",
  },

  statsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px",
    flexWrap: "wrap",
  },

  statsSubtitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "14px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  statCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "16px",
    display: "grid",
    gap: "6px",
  },

  statLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },

  statValue: {
    color: "#fff",
    fontSize: "24px",
  },

  statsDetailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "12px",
  },

  statsPanel: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "16px",
  },

  statsPanelTitle: {
    margin: "0 0 12px",
    fontSize: "16px",
  },

  statsList: {
    display: "grid",
    gap: "8px",
  },

  statsListItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    color: "#cbd5e1",
    fontSize: "13px",
  },

  statsChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },

  statsChip: {
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
  },

  statsEmptyText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "13px",
  },

  docsSection: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
  },

  docsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },


  docsHeaderActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  exportBtn: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#059669",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "8px",
    fontSize: "22px",
  },

  archiveStats: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "14px",
  },

  uploadRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  searchRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  searchInput: {
    flex: 1,
    minWidth: "260px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    outline: "none",
  },

  primaryBtn: {
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: "bold",
  },

  clearBtn: {
    padding: "11px 14px",
    borderRadius: "12px",
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: "bold",
    alignSelf: "end",
  },

  message: {
    marginTop: "14px",
    color: "#d1d5db",
  },

  processingHint: {
    marginTop: "12px",
    color: "#fbbf24",
    fontSize: "14px",
  },

  aiHistoryInfo: {
    marginTop: "12px",
    color: "#94a3b8",
    fontSize: "14px",
  },


  activeFilterHint: {
    margin: "0 0 16px",
    color: "#fbbf24",
    fontSize: "14px",
  },

  emptyBox: {
    padding: "18px",
    borderRadius: "12px",
    backgroundColor: "#0f172a",
    color: "#cbd5e1",
  },

  filtersCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    padding: "14px",
    borderRadius: "16px",
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    marginBottom: "18px",
  },

  filterGroup: {
    display: "grid",
    gap: "6px",
  },

  filterLabel: {
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "700",
  },

  filterInput: {
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid #334155",
    backgroundColor: "#111827",
    color: "#fff",
    outline: "none",
  },

  docsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "16px",
  },

  docCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "260px",
  },

  cardTopLine: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "12px",
  },

  badge: {
    display: "inline-block",
    width: "fit-content",
    padding: "5px 9px",
    borderRadius: "999px",
    backgroundColor: "#1d4ed8",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  statusBadge: {
    display: "inline-block",
    width: "fit-content",
    padding: "5px 9px",
    borderRadius: "999px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "bold",
  },

  statusOk: {
    backgroundColor: "#047857",
  },

  statusProcessing: {
    backgroundColor: "#ca8a04",
  },

  statusWarn: {
    backgroundColor: "#b45309",
  },

  statusError: {
    backgroundColor: "#dc2626",
  },

  docTitle: {
    margin: 0,
    fontSize: "17px",
    wordBreak: "break-word",
  },

  docMeta: {
    marginTop: "8px",
    color: "#94a3b8",
    fontSize: "14px",
  },

  processingBox: {
    display: "grid",
    gap: "4px",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    backgroundColor: "rgba(202, 138, 4, 0.15)",
    border: "1px solid rgba(202, 138, 4, 0.35)",
    color: "#fde68a",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  errorBox: {
    display: "grid",
    gap: "4px",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    border: "1px solid rgba(220, 38, 38, 0.35)",
    color: "#fecaca",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  docInfoBox: {
    marginTop: "10px",
    display: "grid",
    gap: "7px",
  },

  docInfo: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: 1.35,
  },

  docSummary: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  tagsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "4px",
  },

  tag: {
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
  },

  docActions: {
    display: "flex",
    gap: "12px",
    marginTop: "auto",
    alignItems: "center",
  },

  previewBtn: {
    display: "inline-block",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "bold",
    textDecoration: "none",
  },


  reprocessBtn: {
    backgroundColor: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  deleteBtn: {
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  resultsBox: {
    marginTop: "18px",
    display: "grid",
    gap: "12px",
  },

  resultItem: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "16px",
    display: "grid",
    gap: "8px",
  },
};

export default Dashboard;
