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

  const handleLogout = () => {
    logout();
    navigate("/login");
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
                      href={doc.file?.url.replace(
                        "/upload/",
                        "/upload/fl_attachment/"
                      )}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.docLink}
                    >
                      Descarcă
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
};

export default Dashboard;