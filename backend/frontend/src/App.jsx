import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadDocs = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`);
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

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial",
        minHeight: "100vh",
        backgroundColor: "#1f1f1f",
        color: "#f2f2f2",
      }}
    >
      <h1 style={{ fontSize: "56px", marginBottom: "30px" }}>
        Arhiva Cloud Documente
      </h1>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={uploadFile}
          disabled={loading}
          style={{
            padding: "10px 22px",
            backgroundColor: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {message && (
        <p style={{ marginTop: "20px", color: "#ddd", fontSize: "16px" }}>
          {message}
        </p>
      )}

      <h2 style={{ marginTop: "40px", fontSize: "28px" }}>Documente</h2>

      {docs.length === 0 ? (
        <p>Nu există documente încă.</p>
      ) : (
        docs.map((doc) => (
          <div key={doc._id} style={{ marginBottom: "14px" }}>
            <a
              href={doc.file?.url}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#6c63ff",
                textDecoration: "underline",
                fontSize: "18px",
              }}
            >
              {doc.file?.originalName}
            </a>
          </div>
        ))
      )}
    </div>
  );
}

export default App;