import { useEffect, useState } from "react";
import axios from "axios";
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

function formatCategory(category) {
  return CATEGORY_LABELS[category] || category || "Altul";
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

function normalizeText(value = "") {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();

  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    loadDocs();
  }, []);

  const uploadFile = async () => {
    try {
      if (!file) {
        setMessage("Selectează un fișier mai întâi.");
        return;
      }

      setLoading(true);
      setMessage("Se încarcă și se analizează fișierul...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Upload OK:", res.data);
      setMessage("Upload reușit! Documentul a fost analizat.");
      setFile(null);

      await loadDocs();
    } catch (err) {
      console.error("Eroare upload:", err);
      setMessage(
        "Eroare upload: " + (err.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
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

  const filteredDocs = docs.filter((doc) => {
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;

    const matchesYear =
      yearFilter === "all" || String(doc.year) === String(yearFilter);

    const matchesMonth =
      monthFilter === "all" || String(doc.month) === String(monthFilter);

    const matchesSupplier =
      !supplierFilter.trim() ||
      normalizeText(doc.supplier).includes(normalizeText(supplierFilter)) ||
      normalizeText(doc.file?.originalName).includes(normalizeText(supplierFilter));

    return matchesCategory && matchesYear && matchesMonth && matchesSupplier;
  });

  const classifiedCount = docs.filter(
    (doc) => doc.classificationStatus === "classified"
  ).length;

  const resetArchiveFilters = () => {
    setCategoryFilter("all");
    setYearFilter("all");
    setMonthFilter("all");
    setSupplierFilter("");
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>Arhiva Cloud</h2>

        <p style={styles.userText}>
          Bun venit, {user?.name || "Utilizator"}
        </p>

        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Dashboard documente</h1>
          <p style={styles.subtitle}>
            Încarcă, gestionează și accesează documentele tale.
          </p>
        </div>

        <section style={styles.uploadCard}>
          <h3 style={styles.sectionTitle}>Upload document</h3>

          <div style={styles.uploadRow}>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button
              style={styles.primaryBtn}
              onClick={uploadFile}
              disabled={loading}
            >
              {loading ? "Se procesează..." : "Upload"}
            </button>
          </div>

          {message && <p style={styles.message}>{message}</p>}
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
                <div key={item.chunk?.id || item.document._id} style={styles.resultItem}>
                  <strong>{item.document.file?.originalName}</strong>

                  <p style={styles.docMeta}>
                    Scor relevanță: {item.score.toFixed(3)}
                  </p>

                  {item.document.category && (
                    <span style={styles.badge}>
                      {formatCategory(item.document.category)}
                    </span>
                  )}

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

          {aiNotes.length > 0 && (
            <p style={styles.aiHistoryInfo}>
              Ai {aiNotes.length} răspuns(uri) AI în istoric.
            </p>
          )}
        </section>

        <section style={styles.docsSection}>
          <div style={styles.docsHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Documentele mele</h3>
              <p style={styles.archiveStats}>
                {docs.length} document(e) total • {classifiedCount} clasificate de IA •{" "}
                {filteredDocs.length} afișate
              </p>
            </div>

            <button style={styles.secondaryBtn} onClick={loadDocs}>
              Reîncarcă
            </button>
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

                return (
                  <div key={doc._id} style={styles.docCard}>
                    <div>
                      <div style={styles.cardTopLine}>
                        <span style={styles.badge}>
                          {formatCategory(doc.category)}
                        </span>

                        {doc.classificationStatus && (
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

  aiHistoryInfo: {
    marginTop: "12px",
    color: "#94a3b8",
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

  statusWarn: {
    backgroundColor: "#b45309",
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
