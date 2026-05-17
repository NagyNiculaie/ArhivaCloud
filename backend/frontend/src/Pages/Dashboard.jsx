import { useEffect, useState } from "react";
import axios from "axios";
import { getToken, getUser, logout } from "../Utils/auth";
import { useNavigate } from "react-router-dom";


const API_URL = import.meta.env.VITE_API_URL;

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
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState([]);
  const [askLoading, setAskLoading] = useState(false);


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
      setMessage("Se încarcă fișierul...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        `${API_URL}/documents/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Upload OK:", res.data);
      setMessage("Upload reușit!");
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
        "Eroare la ștergere: " +
          (err.response?.data?.error || err.message)
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
    setMessage("Se caută semantic...");

    const res = await axios.post(
      `${API_URL}/documents/semantic-search`,
      { query: searchQuery },
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );
    const askDocuments = async () => {
  try {
    if (!question.trim()) {
      setMessage("Scrie o întrebare.");
      return;
    }

    setAskLoading(true);
    setAiAnswer("");
    setAiSources([]);

    const res = await axios.post(
      `${API_URL}/documents/ask`,
      { question },
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    setAiAnswer(res.data.answer || "");
    setAiSources(res.data.sources || []);

  } catch (err) {
    console.error("Ask AI error:", err);

    setMessage(
      "Eroare AI: " +
        (err.response?.data?.error || err.message)
    );
  } finally {
    setAskLoading(false);
  }
};

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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const previewDocument = async (id) => {
  try {
    const res = await axios.get(
      `${API_URL}/documents/${id}/preview`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        responseType: "blob",
      }
    );

    const url = window.URL.createObjectURL(new Blob([res.data]));
    window.open(url);

  } catch (err) {
    console.error("Preview error:", err);
    setMessage("Eroare la preview.");
  }
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
          <div>
            <h1 style={styles.title}>Dashboard documente</h1>
            <p style={styles.subtitle}>
              Încarcă, gestionează și accesează documentele tale.
            </p>
          </div>
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
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {message && <p style={styles.message}>{message}</p>}
        </section>
        <section style={styles.searchCard}>
  <h3 style={styles.sectionTitle}>Cautare inteligenta cu IA</h3>

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
      {searchLoading ? "Caută..." : "Caută AI"}
    </button>
  </div>

  {searchResults.length > 0 && (
    <div style={styles.resultsBox}>
      {searchResults.map((item) => (
        <div key={item.document._id} style={styles.resultItem}>
          <strong>{item.document.file?.originalName}</strong>
          <p style={styles.docMeta}>
            Scor relevanță: {item.score.toFixed(3)}
          </p>

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
//documentele mele
<section style={styles.askCard}>
  <h3 style={styles.sectionTitle}>
    Întreabă documentele tale
  </h3>

  <div style={styles.searchRow}>
    <input
      type="text"
      placeholder="Ex: Care este valoarea totală din factura Vodafone?"
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
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

  {aiAnswer && (
    <div style={styles.aiAnswerBox}>
      <h4 style={{ marginTop: 0 }}>
        Răspuns AI
      </h4>

      <p style={styles.aiAnswerText}>
        {aiAnswer}
      </p>

      {aiSources.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <strong>Surse utilizate:</strong>

          <div style={styles.resultsBox}>
            {aiSources.map((source) => (
              <div
                key={source.id}
                style={styles.resultItem}
              >
                <strong>{source.fileName}</strong>

                <p style={styles.docMeta}>
                  Relevanță: {source.score.toFixed(3)}
                </p>

                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.previewBtn}
                >
                  Preview
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )}
</section>

        <section style={styles.docsSection}>
          <h3 style={styles.sectionTitle}>Documentele mele</h3>

          {docs.length === 0 ? (
            <div style={styles.emptyBox}>Nu există documente încă.</div>
          ) : (
            <div style={styles.docsGrid}>
              {docs.map((doc) => (
                <div key={doc._id} style={styles.docCard}>
                  <div>
                    <h4 style={styles.docTitle}>{doc.file?.originalName}</h4>
                    <p style={styles.docMeta}>
                      {doc.file?.mimeType || "Fișier"}
                    </p>
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
              ))}
            </div>
          )}
        </section>
      </main>
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
  sectionTitle: {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "22px",
  },
  uploadRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
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
  message: {
    marginTop: "14px",
    color: "#d1d5db",
  },
  docsSection: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "18px",
    padding: "24px",
  },
  emptyBox: {
    padding: "18px",
    borderRadius: "12px",
    backgroundColor: "#0f172a",
    color: "#cbd5e1",
  },
  docsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
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
  docActions: {
    display: "flex",
    gap: "12px",
    marginTop: "auto",
    alignItems: "center",
  },
  docLink: {
    color: "#818cf8",
    textDecoration: "none",
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
  //STYLE PREVIEW DOC
  previewBtn: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "30px",
  },

  modal: {
    width: "90%",
    height: "90%",
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "18px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  closeBtn: {
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  previewFrame: {
    flex: 1,
    width: "100%",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#fff",
  },
  searchCard: {
  backgroundColor: "#111827",
  border: "1px solid #1f2937",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "24px",
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
},
askCard: {
  backgroundColor: "#111827",
  border: "1px solid #1f2937",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "24px",
},

aiAnswerBox: {
  marginTop: "20px",
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "14px",
  padding: "20px",
},

aiAnswerText: {
  color: "#e2e8f0",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
},
};

export default Dashboard